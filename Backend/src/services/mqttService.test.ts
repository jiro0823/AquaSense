import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { afterEach, mock, test } from 'node:test';
import mqtt from 'mqtt';
import { MQTTService } from './mqttService';
import { config } from '../config/config';
import { sensorReadingService } from './sensorReadingService';
import { waterAlertNotificationService } from './waterAlertNotification.service';
import { deviceService } from './device.service';

afterEach(() => mock.restoreAll());

test('MQTT connection status follows connect, offline, close, and reconnect events', async () => {
  const subscriptions: string[][] = [];
  const publications: Array<{ topic: string; payload: string; options: object }> = [];
  const client = Object.assign(new EventEmitter(), {
    subscribe: (topics: string[], callback: (error?: Error | null) => void) => {
      subscriptions.push(topics);
      callback(null);
    },
    publish: (topic: string, payload: string, options: object, callback: (error?: Error | null) => void) => {
      publications.push({ topic, payload, options });
      callback(null);
    },
    end: (_force: boolean, callback: () => void) => callback(),
  });
  mock.method(mqtt, 'connect', () => client as any);

  const service = new MQTTService({ brokerUrl: 'mqtt://test.invalid' });
  mock.method(service as any, 'redeliverPendingActuatorCommands', async () => undefined);
  await service.connect();

  client.emit('connect');
  assert.equal(service.getStatus().connected, true);
  assert.equal(client.listenerCount('message'), 1);
  assert.equal(subscriptions.length, 1);
  assert.ok(subscriptions[0].includes('water/commands/#'));
  assert.deepEqual(service.getStatus().subscribedTopics, subscriptions[0]);
  assert.deepEqual(JSON.parse(publications[0].payload).status, 'online');
  assert.equal(publications[0].topic, 'water/esp32/status');

  client.emit('offline');
  assert.equal(service.getStatus().connected, false);
  assert.equal(await service.dispatchHardwareCommand({
    id: '00000000-0000-4000-8000-000000000001',
    deviceId: 'test-device',
    source: 'hardware',
    action: 'ALL_OFF',
    expiresAt: new Date(Date.now() + 1000),
  }), false);

  client.emit('close');
  assert.equal(service.getStatus().connected, false);

  client.emit('connect');
  assert.equal(service.getStatus().connected, true);
  assert.equal(client.listenerCount('message'), 1);
  assert.equal(subscriptions.length, 2);

  await service.disconnect();
  const offlinePublication = publications.at(-1);
  assert.equal(offlinePublication?.topic, 'water/esp32/status');
  assert.equal(JSON.parse(offlinePublication!.payload).status, 'offline');
});

test('legacy command topics match only the configured command hierarchy', () => {
  const service = new MQTTService();
  const received: string[] = [];
  mock.method(service as any, 'handleCommand', (topic: string) => { received.push(topic); });

  (service as any).handleMessage('water/commands/threshold-update', Buffer.from('{}'));
  (service as any).handleMessage('water/command/threshold-update', Buffer.from('{}'));

  assert.deepEqual(received, ['water/commands/threshold-update']);
});

test('device-scoped telemetry keeps interleaved device assemblies separate and trusts topic identity', async () => {
  const previousKeys = config.device.keys;
  config.device.keys = { 'device-a': 'key-a', 'device-b': 'key-b', inactive: 'key-inactive' };
  const ingested: Array<{ deviceId: string; payload: any }> = [];
  mock.method(sensorReadingService, 'ingest', async (deviceId: string, payload: any) => {
    ingested.push({ deviceId, payload });
    return { id: `reading-${deviceId}`, do: null, doMeasured: false } as any;
  });
  mock.method(sensorReadingService, 'getStatistics', async () => ({}) as any);
  mock.method(waterAlertNotificationService, 'processReading', async () => undefined);
  mock.method(deviceService, 'getActiveDevice', async (deviceId: string) => deviceId === 'inactive' ? null : ({ id: deviceId }) as any);

  try {
    const service = new MQTTService({ brokerUrl: 'mqtts://broker.test', deviceScopedTopics: true });
    const receive = (deviceId: string, parameter: string, value: string) =>
      (service as any).handleMessage(`aquasense/${deviceId}/telemetry/${parameter}`, Buffer.from(value));

    receive('device-a', 'temperature', '20');
    receive('device-b', 'ph', '7.1');
    receive('device-a', 'ph', '6.8');
    receive('device-b', 'temperature', '25');
    receive('device-a', 'turbidity-ntu', '11');
    receive('device-b', 'turbidity-ntu', '22');
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepEqual(ingested.map(({ deviceId, payload }) => [deviceId, payload.temperature, payload.ph, payload.turbidity]), [
      ['device-a', 20, 6.8, 11],
      ['device-b', 25, 7.1, 22],
    ]);
    assert.equal(ingested.every(({ deviceId, payload }) => payload.deviceId === deviceId), true);

    receive('unknown-device', 'temperature', '99');
    receive('device-a/forged', 'ph', '2');
    receive('inactive', 'temperature', '30');
    receive('inactive', 'ph', '7');
    receive('inactive', 'turbidity-ntu', '30');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal((service as any).telemetryByDevice.has('unknown-device'), false);
    assert.equal(ingested.some(({ deviceId }) => deviceId === 'inactive'), false);

    await (service as any).handleSensorReading(JSON.stringify({ deviceId: 'device-b', temperature: 19 }), 'device-a');
    assert.equal(ingested.at(-1)?.deviceId, 'device-a');
    assert.equal(ingested.at(-1)?.payload.deviceId, 'device-a');
  } finally {
    config.device.keys = previousKeys;
  }
});

test('MQTT refuses incomplete broker credentials before opening a connection', async () => {
  let connectCalls = 0;
  mock.method(mqtt, 'connect', () => { connectCalls++; throw new Error('must not connect'); });
  const service = new MQTTService({ brokerUrl: 'mqtts://broker.test', username: 'device-user' });
  await assert.rejects(service.connect(), /must be configured together/);
  assert.equal(connectCalls, 0);
});

test('MQTT status redacts broker URL userinfo, query parameters, and fragments', () => {
  const service = new MQTTService({ brokerUrl: 'mqtts://user:password@broker.test:8883/mqtt?token=secret&client=board#private' });
  const statusUrl = service.getStatus().brokerUrl;
  assert.equal(statusUrl, 'mqtts://broker.test:8883/mqtt');
  assert.equal(statusUrl.includes('secret'), false);
  assert.equal(statusUrl.includes('password'), false);
});

test('device-scoped backend subscribes only to scoped telemetry and signed state topics', async () => {
  const subscriptions: string[][] = [];
  let connectOptions: any;
  const client = Object.assign(new EventEmitter(), {
    subscribe: (topics: string[], callback: (error?: Error | null) => void) => { subscriptions.push(topics); callback(null); },
    publish: (_topic: string, _payload: string, _options: object, callback: (error?: Error | null) => void) => callback(null),
    end: (_force: boolean, callback: () => void) => callback(),
  });
  mock.method(mqtt, 'connect', (_url: string, options: any) => { connectOptions = options; return client as any; });
  const service = new MQTTService({ brokerUrl: 'mqtts://broker.test', username: 'backend-user', password: 'backend-password',
    caCertificate: 'test-ca', deviceScopedTopics: true });
  mock.method(service as any, 'redeliverPendingActuatorCommands', async () => undefined);
  await service.connect();
  assert.equal(connectOptions.rejectUnauthorized, true);
  assert.equal(connectOptions.ca, 'test-ca');
  assert.equal(connectOptions.username, 'backend-user');
  assert.equal(connectOptions.password, 'backend-password');
  client.emit('connect');
  assert.deepEqual(subscriptions[0], ['aquasense/+/telemetry/+', 'aquasense/+/state']);
  assert.deepEqual(service.getStatus().subscribedTopics, subscriptions[0]);
  client.emit('message', 'aquasense/device-a/telemetry/ph', Buffer.from('7'), { retain: true });
  assert.equal((service as any).telemetryByDevice.size, 0);
  client.emit('offline');
  client.emit('connect');
  assert.equal(subscriptions.length, 2);
  assert.deepEqual(subscriptions[1], subscriptions[0]);
  await service.disconnect();
});
