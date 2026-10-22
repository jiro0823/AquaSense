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
    subscribe: (topics: string[], callback: (error: Error | null, granted: Array<{ topic: string; qos: number }>) => void) => {
      subscriptions.push(topics);
      callback(null, topics.map(topic => ({ topic, qos: 1 })));
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
  assert.equal((publications[0].options as { retain?: boolean }).retain, false);

  client.emit('offline');
  assert.equal(service.getStatus().connected, false);
  assert.deepEqual(service.getStatus().subscribedTopics, []);
  assert.equal(await service.dispatchHardwareCommand({
    id: '00000000-0000-4000-8000-000000000001',
    deviceId: 'test-device',
    source: 'hardware',
    action: 'ALL_OFF',
    expiresAt: new Date(Date.now() + 1000),
  }), false);

  client.emit('close');
  assert.equal(service.getStatus().connected, false);
  assert.deepEqual(service.getStatus().subscribedTopics, []);

  client.emit('connect');
  assert.equal(service.getStatus().connected, true);
  assert.equal(client.listenerCount('message'), 1);
  assert.equal(subscriptions.length, 2);

  await service.disconnect();
  const offlinePublication = publications.at(-1);
  assert.equal(offlinePublication?.topic, 'water/esp32/status');
  assert.equal(JSON.parse(offlinePublication!.payload).status, 'offline');
  assert.equal((offlinePublication!.options as { retain?: boolean }).retain, false);
  assert.deepEqual(service.getStatus().subscribedTopics, []);
});

test('repeated MQTT connect calls reuse one client until explicit disconnect', async () => {
  let connectCalls = 0;
  const client = Object.assign(new EventEmitter(), {
    subscribe: (topics: string[], callback: (error: Error | null, granted: Array<{ topic: string; qos: number }>) => void) =>
      callback(null, topics.map(topic => ({ topic, qos: 1 }))),
    publish: (_topic: string, _payload: string, _options: object, callback: (error?: Error | null) => void) => callback(null),
    end: (_force: boolean, callback: () => void) => callback(),
  });
  mock.method(mqtt, 'connect', () => { connectCalls++; return client as any; });

  const service = new MQTTService({ brokerUrl: 'mqtt://test.invalid' });
  mock.method(service as any, 'redeliverPendingActuatorCommands', async () => undefined);
  await Promise.all([service.connect(), service.connect()]);
  await service.connect();
  assert.equal(connectCalls, 1);

  client.emit('connect');
  await service.disconnect();
  await service.connect();
  assert.equal(connectCalls, 2, 'an explicit disconnect releases the client for a later connect');
});

test('MQTT status reports only SUBACK-accepted topics and clears them on failure or disconnect', async () => {
  type SubscribeCallback = (error: Error | null, granted?: Array<{ topic: string; qos: number }>) => void;
  const callbacks: SubscribeCallback[] = [];
  const client = Object.assign(new EventEmitter(), {
    subscribe: (_topics: string[], callback: SubscribeCallback) => callbacks.push(callback),
    publish: (_topic: string, _payload: string, _options: object, callback: (error?: Error | null) => void) => callback(null),
    end: (_force: boolean, callback: () => void) => callback(),
  });
  mock.method(mqtt, 'connect', () => client as any);
  const service = new MQTTService({ brokerUrl: 'mqtts://broker.test', deviceScopedTopics: true });
  mock.method(service as any, 'redeliverPendingActuatorCommands', async () => undefined);

  await service.connect();
  client.emit('connect');
  const requested = ['aquasense/+/telemetry/+', 'aquasense/+/state'];
  assert.deepEqual(service.getStatus().subscribedTopics, []);
  callbacks[0](null, [{ topic: requested[0], qos: 1 }, { topic: requested[1], qos: 128 }]);
  assert.deepEqual(service.getStatus().subscribedTopics, [requested[0]]);

  client.emit('offline');
  assert.deepEqual(service.getStatus().subscribedTopics, []);
  client.emit('connect');
  callbacks[1](new Error('subscription rejected'));
  assert.deepEqual(service.getStatus().subscribedTopics, []);

  client.emit('offline');
  callbacks[0](null, requested.map(topic => ({ topic, qos: 1 })));
  assert.deepEqual(service.getStatus().subscribedTopics, [], 'late SUBACK from a prior connection is ignored');
  await service.disconnect();
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

test('device-scoped sequenced frames persist invalid sensor states and suppress duplicate topic assembly', async () => {
  const previousKeys = config.device.keys;
  config.device.keys = { 'device-frame': 'key-frame' };
  const ingested: Array<{ deviceId: string; payload: any }> = [];
  mock.method(sensorReadingService, 'ingest', async (deviceId: string, payload: any) => {
    ingested.push({ deviceId, payload });
    return { id: 'reading-frame', do: null, doMeasured: false } as any;
  });
  mock.method(sensorReadingService, 'getStatistics', async () => ({}) as any);
  mock.method(waterAlertNotificationService, 'processReading', async () => undefined);
  mock.method(deviceService, 'getActiveDevice', async () => ({ id: 'device-frame' }) as any);

  try {
    const service = new MQTTService({ brokerUrl: 'mqtts://broker.test', deviceScopedTopics: true });
    const bootId = 'a1b2c3d4e5f60718';
    const frame = { v: 1, deviceId: 'device-frame', bootId, sequence: 7, messageId: `${bootId}-7`,
      timestamp: Date.now(), sampleAgeMs: 0, temperature: null, ph: null, turbidity: null, orp: null,
      turbidityUnit: 'unknown', sensors: { temperature: { connected: false }, ph: { connected: true, rawAdc: 0 },
        turbidity: { connected: true, rawAdc: 2100 }, orp: { connected: true, rawAdc: 2200 } } };
    (service as any).handleMessage('aquasense/device-frame/telemetry/frame', Buffer.from(JSON.stringify(frame)));
    (service as any).handleMessage('aquasense/device-frame/telemetry/temperature', Buffer.from('DISCONNECTED'));
    (service as any).handleMessage('aquasense/device-frame/telemetry/ph', Buffer.from('UNVERIFIED'));
    (service as any).handleMessage('aquasense/device-frame/telemetry/turbidity-ntu', Buffer.from('UNVERIFIED'));
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(ingested.length, 1);
    assert.equal(ingested[0].deviceId, 'device-frame');
    assert.equal(ingested[0].payload.temperature, null);
    assert.equal(ingested[0].payload.ph, null);
    assert.equal(ingested[0].payload.turbidity, null);
    assert.equal(ingested[0].payload.messageId, `${bootId}-7`);
    assert.equal(ingested[0].payload.sensors.temperature.connected, false);

    const spoof = { ...frame, deviceId: 'other-device', sequence: 8, messageId: `${bootId}-8` };
    (service as any).handleMessage('aquasense/device-frame/telemetry/frame', Buffer.from(JSON.stringify(spoof)));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ingested.length, 1);
  } finally {
    config.device.keys = previousKeys;
  }
});

test('public development frame accepts strictly shaped provisional diagnostics and preserves them for ingestion', async () => {
  const previousKeys = config.device.keys;
  config.device.keys = { 'device-provisional': 'key-provisional' };
  const ingested: any[] = [];
  mock.method(sensorReadingService, 'ingest', async (_deviceId: string, payload: any) => {
    ingested.push(payload);
    return { id: 'reading-provisional', do: null, doMeasured: false } as any;
  });
  mock.method(sensorReadingService, 'getStatistics', async () => ({}) as any);
  mock.method(waterAlertNotificationService, 'processReading', async () => undefined);
  mock.method(deviceService, 'getActiveDevice', async () => ({ id: 'device-provisional' }) as any);
  const service = new MQTTService({ brokerUrl: 'mqtt://broker.hivemq.com:1883', deviceScopedTopics: true, topicNamespace: 'aquasense-dev', actuatorCommandsEnabled: false });
  const bootId = 'a1b2c3d4e5f60718';
  const frame = { v: 1, deviceId: 'device-provisional', bootId, sequence: 2, messageId: `${bootId}-2`,
    timestamp: Date.now(), sampleAgeMs: 0, temperature: null, ph: null, turbidity: null, orp: null,
    sensors: { ph: { connected: false, sampleAgeMs: 3, provisional: { value: 7.65, unit: 'pH', status: 'UNVERIFIED' } },
      turbidity: { connected: false, sampleAgeMs: 4, provisional: { value: 120, unit: 'NTU', status: 'UNVERIFIED' } },
      orp: { connected: false, sampleAgeMs: 5, provisional: { value: 250, unit: 'mV', status: 'UNVERIFIED' } } } };
  try {
    (service as any).handleScopedTelemetryTopic('aquasense-dev/device-provisional/telemetry/frame', JSON.stringify(frame));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ingested.length, 1);
    assert.deepEqual(ingested[0].sensors.ph.provisional, frame.sensors.ph.provisional);
    assert.deepEqual(ingested[0].sensors.turbidity.provisional, frame.sensors.turbidity.provisional);
    assert.deepEqual(ingested[0].sensors.orp.provisional, frame.sensors.orp.provisional);
    assert.equal(ingested[0].ph, null);
  } finally {
    config.device.keys = previousKeys;
  }
});

test('MQTT rejects malformed and non-public-profile provisional diagnostics', async () => {
  const previousKeys = config.device.keys;
  config.device.keys = { 'device-provisional': 'key-provisional' };
  const ingested: any[] = [];
  mock.method(sensorReadingService, 'ingest', async (_deviceId: string, payload: any) => { ingested.push(payload); return {} as any; });
  mock.method(deviceService, 'getActiveDevice', async () => ({ id: 'device-provisional' }) as any);
  const bootId = 'a1b2c3d4e5f60718';
  const base = { v: 1, deviceId: 'device-provisional', bootId, sequence: 1, messageId: `${bootId}-1`, timestamp: Date.now(),
    temperature: null, ph: null, turbidity: null, orp: null, sensors: { ph: { provisional: { value: '7.65', unit: 'pH', status: 'UNVERIFIED' } } } };
  try {
    const publicProfile = new MQTTService({ brokerUrl: 'mqtt://broker.hivemq.com:1883', deviceScopedTopics: true, topicNamespace: 'aquasense-dev', actuatorCommandsEnabled: false });
    (publicProfile as any).handleScopedTelemetryTopic('aquasense-dev/device-provisional/telemetry/frame', JSON.stringify(base));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ingested.length, 0, 'non-numeric provisional value must be rejected');

    const productionProfile = new MQTTService({ brokerUrl: 'mqtts://broker.test', deviceScopedTopics: true, topicNamespace: 'aquasense' });
    const valid = { ...base, sequence: 2, messageId: `${bootId}-2`, sensors: { ph: { provisional: { value: 7.65, unit: 'pH', status: 'UNVERIFIED' } } } };
    (productionProfile as any).handleScopedTelemetryTopic('aquasense/device-provisional/telemetry/frame', JSON.stringify(valid));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ingested.length, 0, 'provisional diagnostics must be rejected outside public development profile');
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
    subscribe: (topics: string[], callback: (error: Error | null, granted: Array<{ topic: string; qos: number }>) => void) => { subscriptions.push(topics); callback(null, topics.map(topic => ({ topic, qos: 1 }))); },
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

test('configured namespace controls scoped subscriptions and telemetry parsing', async () => {
  const previousKeys = config.device.keys;
  config.device.keys = { 'dev-device': 'dev-key' };
  const subscriptions: string[][] = [];
  const ingested: Array<{ deviceId: string; payload: any }> = [];
  const client = Object.assign(new EventEmitter(), {
    subscribe: (topics: string[], callback: (error: Error | null, granted: Array<{ topic: string; qos: number }>) => void) => { subscriptions.push(topics); callback(null, topics.map(topic => ({ topic, qos: 1 }))); },
    publish: (_topic: string, _payload: string, _options: object, callback: (error?: Error | null) => void) => callback(null),
    end: (_force: boolean, callback: () => void) => callback(),
  });
  mock.method(mqtt, 'connect', () => client as any);
  mock.method(sensorReadingService, 'ingest', async (deviceId: string, payload: any) => {
    ingested.push({ deviceId, payload });
    return { id: 'reading-dev', do: null, doMeasured: false } as any;
  });
  mock.method(sensorReadingService, 'getStatistics', async () => ({}) as any);
  mock.method(waterAlertNotificationService, 'processReading', async () => undefined);
  mock.method(deviceService, 'getActiveDevice', async (deviceId: string) => ({ id: deviceId }) as any);

  try {
    const service = new MQTTService({ brokerUrl: 'mqtt://broker.test', deviceScopedTopics: true, topicNamespace: 'aquasense-dev' });
    mock.method(service as any, 'redeliverPendingActuatorCommands', async () => undefined);
    await service.connect();
    client.emit('connect');
    assert.deepEqual(subscriptions[0], ['aquasense-dev/+/telemetry/+', 'aquasense-dev/+/state']);
    client.emit('message', 'aquasense-dev/dev-device/telemetry/temperature', Buffer.from('22'), { retain: false });
    client.emit('message', 'aquasense-dev/dev-device/telemetry/ph', Buffer.from('7.2'), { retain: false });
    client.emit('message', 'aquasense-dev/dev-device/telemetry/turbidity-ntu', Buffer.from('10'), { retain: false });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ingested.length, 1);
    assert.equal(ingested[0].deviceId, 'dev-device');
    assert.equal(ingested[0].payload.temperature, 22);
    assert.equal(ingested[0].payload.ph, 7.2);
    assert.equal(ingested[0].payload.turbidity, 10);
    await service.disconnect();
  } finally {
    config.device.keys = previousKeys;
  }
});

test('public development profile cannot publish actuator commands', async () => {
  const publications: string[] = [];
  const client = {
    publish: (topic: string, _payload: string, _options: object, callback: (error?: Error | null) => void) => {
      publications.push(topic);
      callback(null);
    },
  };
  const service = new MQTTService({ brokerUrl: 'mqtt://broker.test', topicNamespace: 'aquasense-dev', actuatorCommandsEnabled: false });
  (service as any).client = client;
  (service as any).isConnected = true;

  const dispatched = await service.dispatchHardwareCommand({
    id: '00000000-0000-4000-8000-000000000001',
    deviceId: 'dev-device',
    source: 'hardware',
    action: 'ALL_OFF',
    expiresAt: new Date(Date.now() + 1000),
  });

  assert.equal(dispatched, false);
  assert.deepEqual(publications, []);
});

test('actuator command uses the configured namespace and remains non-retained', async () => {
  const previousKeys = config.device.keys;
  config.device.keys = { 'dev-device': 'dev-key' };
  const publications: Array<{ topic: string; options: object }> = [];
  const service = new MQTTService({ brokerUrl: 'mqtts://broker.test:8883', username: 'test-user', password: 'test-password',
    topicNamespace: 'aquasense-dev', deviceScopedTopics: true, actuatorCommandsEnabled: true });
  (service as any).client = {
    publish: (topic: string, _payload: string, options: object, callback: (error?: Error | null) => void) => {
      publications.push({ topic, options });
      callback(null);
    },
  };
  (service as any).isConnected = true;

  try {
    const dispatched = await service.dispatchHardwareCommand({
      id: '00000000-0000-4000-8000-000000000001',
      deviceId: 'dev-device',
      source: 'hardware',
      action: 'ALL_OFF',
      expiresAt: new Date(Date.now() + 1000),
    });
    assert.equal(dispatched, true);
    assert.equal(publications[0].topic, 'aquasense-dev/dev-device/command');
    assert.equal((publications[0].options as { retain?: boolean }).retain, false);
  } finally {
    config.device.keys = previousKeys;
  }
});
