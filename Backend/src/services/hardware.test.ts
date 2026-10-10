import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import hardwareRoutes from '../api/v1/routes/hardware';
import { ackCanonical, commandCanonical, hardwareCommandSchema, hardwareStateSchema, hardwareSyncSchema, parseSignedAck, parseSignedCommand, signCanonical, verifyCanonical, type HardwareState } from './hardwareProtocol';
import { hardwareService } from './hardwareService';
import { HardwareCommand, HardwareDeviceState } from '../database/models/HardwareControl';
import { FeedingCommand } from '../database/models/FeedingCommand';
import { feedingService } from './feedingService';
import { deviceService } from './device.service';
import { auditLogService } from './auditLog.service';
import { tokenService } from '../utils/tokenService';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { parseOrp, orpStatistics } from './sensorValues';
import { MQTTService } from './mqttService';
import { sensorReadingService } from './sensorReadingService';
import { waterAlertNotificationService } from './waterAlertNotification.service';
import { csrfProtection } from '../middleware/csrfProtection';

const originalKeys = config.device.keys;
afterEach(() => { mock.restoreAll(); config.device.keys = originalKeys; });
const id = '9f2f2cbb-5e87-4bb3-a95e-c45d05de97d1';
const state: HardwareState = { fillPump: false, drainPump: false, aerator: false, feederBusy: false,
  buzzer: false, automation: false, waterPhase: 'IDLE', fault: '', relaysReady: false, timeValid: false,
  wifiConnected: true, mqttConnected: true, uptimeMs: 123 };

test('pump commands require bounded integer timing; non-pump commands reject timing and extra fields', () => {
  for (const durationMs of [undefined, 0, -1, 1.5, 300001, '1000']) {
    assert.equal(hardwareCommandSchema.safeParse({ deviceId: 'board', action: 'FILL', durationMs }).success, false);
  }
  assert.equal(hardwareCommandSchema.safeParse({ deviceId: 'board', action: 'WATER_EXCHANGE', durationMs: 1000 }).success, true);
  assert.equal(hardwareCommandSchema.safeParse({ deviceId: 'board', action: 'ALL_OFF', durationMs: 1000 }).success, false);
  assert.equal(hardwareCommandSchema.safeParse({ deviceId: 'board', action: 'RAW_GPIO', pin: 25 }).success, false);
  assert.equal(hardwareSyncSchema.safeParse({ deviceId: 'board', state: { ...state, floatWet: true } }).success, false);
  assert.equal(hardwareStateSchema.safeParse({ ...state, waterPhase: 'TRANSITION' }).success, true);
});

test('stop bypasses full queue and ALL_OFF cancels pending feeding starts', async () => {
  const count = mock.method(HardwareCommand, 'count', async () => 20);
  const cancel = mock.method(HardwareCommand, 'update', async () => [20]);
  const cancelFeed = mock.method(FeedingCommand, 'update', async () => [1]);
  const create = mock.method(HardwareCommand, 'create', async (input: unknown) => input);
  await assert.rejects(hardwareService.queue('owner', 'board', 'FILL', 1000), /queue is full/);
  await hardwareService.queue('owner', 'board', 'ALL_OFF');
  assert.equal(count.mock.callCount(), 1);
  assert.equal(cancel.mock.callCount(), 1); assert.equal(cancelFeed.mock.callCount(), 1);
  assert.equal(create.mock.callCount(), 1);
  assert.deepEqual(cancel.mock.calls[0].arguments[1]?.where, { userId: 'owner', deviceId: 'board', status: 'PENDING' });
});

test('receipts are owner/device scoped and duplicate acknowledgments do not execute again', async () => {
  let writes = 0;
  const command = { status: 'PENDING', async update(value: { status: string }) { this.status = value.status; writes++; } };
  const find = mock.method(HardwareCommand, 'findOne', async () => command);
  const receipt = { id, source: 'hardware' as const, result: 'accepted' };
  assert.equal(await hardwareService.acknowledge('owner', 'board', receipt), true);
  assert.equal(await hardwareService.acknowledge('owner', 'board', receipt), true);
  assert.equal(writes, 1);
  assert.deepEqual(find.mock.calls[0].arguments[0]?.where, { id, userId: 'owner', deviceId: 'board' });
  mock.method(HardwareCommand, 'findOne', async () => null);
  assert.equal(await hardwareService.acknowledge('other-owner', 'board', receipt), false);
});

test('legacy authenticated HTTP sync refreshes device state but never delivers or acknowledges commands', async () => {
  const expiry = mock.method(HardwareCommand, 'update', async () => [1]);
  const feedExpiry = mock.method(FeedingCommand, 'update', async () => [1]);
  const stateWrite = mock.method(HardwareDeviceState, 'upsert', async () => [state, true]);
  mock.method(feedingService, 'listSchedules', async () => Array.from({ length: 25 }, (_, i) => ({ id: String(i), enabled: i !== 0, time: '08:00', date: null })));
  const result = await hardwareService.sync('owner', 'board', state);
  assert.equal(result.command, null);
  assert.equal(result.schedules.length, 20); assert.equal(result.schedules[0].id, '1');
  assert.equal(stateWrite.mock.callCount(), 1);
  assert.deepEqual(stateWrite.mock.calls[0].arguments[0], { deviceId: 'board', state, receivedAt: stateWrite.mock.calls[0].arguments[0]?.receivedAt });
  assert.equal(expiry.mock.callCount(), 0); assert.equal(feedExpiry.mock.callCount(), 0);
});

test('signed actuator command and state ACK canonical strings verify HMAC-SHA256', () => {
  const key = 'test-device-secret';
  const command = { v: 1 as const, deviceId: 'board', id, source: 'hardware' as const, action: 'DRAIN', durationMs: 1200, expiresAt: 123456 };
  const signature = signCanonical(commandCanonical(command), key);
  assert.equal(verifyCanonical(commandCanonical(command), signature, key), true);
  assert.equal(verifyCanonical(commandCanonical(command), signature, 'wrong-key'), false);
  const ack = { v: 1 as const, deviceId: 'board', id, source: 'hardware' as const, action: 'DRAIN', result: 'accepted', reportedAt: 123456,
    state, signature: '' };
  assert.equal(ackCanonical(ack), `v1|board|${id}|hardware|DRAIN|accepted|123456|0|0|0|0|0|0|IDLE||0|0|1|1|123`);
  const ackSignature = signCanonical(ackCanonical(ack), key);
  assert.equal(verifyCanonical(ackCanonical(ack), ackSignature, key), true);
  assert.equal(verifyCanonical(ackCanonical({ ...ack, state: { ...state, drainPump: true } }), ackSignature, key), false);
  const signedAck = { ...ack, signature: ackSignature };
  assert.deepEqual(parseSignedAck(JSON.stringify(signedAck)), signedAck);
  assert.equal(parseSignedAck(JSON.stringify({ ...signedAck, ...state, state: undefined })), null);
});

test('MQTT ACK persists its nested state and acknowledges only the matching scoped command', async () => {
  let status = 'PENDING';
  const command = { action: 'DRAIN', status, async update(values: { status: string; result: string }) { status = values.status; } };
  const find = mock.method(HardwareCommand, 'findOne', async () => command);
  const upsert = mock.method(HardwareDeviceState, 'upsert', async () => [state, true]);
  const ack = { v: 1 as const, deviceId: 'board', id, source: 'hardware' as const, action: 'DRAIN', result: 'accepted',
    reportedAt: 123456, state, signature: 'verified-by-mqtt-listener' };
  assert.equal(await hardwareService.acceptMqttAck('owner', ack), true);
  assert.equal(status, 'ACKED');
  assert.deepEqual(find.mock.calls[0].arguments[0]?.where, { id, userId: 'owner', deviceId: 'board' });
  assert.deepEqual(upsert.mock.calls[0].arguments[0], { deviceId: 'board', state, receivedAt: new Date(123456) });
});

test('MQTT actuator publish signs command and explicitly disables retention', async () => {
  config.device.keys = { board: 'test-device-secret' };
  const publishes: Array<{ topic: string; payload: string; options: { qos: number; retain: boolean } }> = [];
  const service = new MQTTService();
  const fakeClient = { publish(topic: string, payload: string, options: { qos: number; retain: boolean }, callback: (error?: Error) => void) {
    publishes.push({ topic, payload, options }); callback();
  } };
  Object.assign(service as unknown as object, { client: fakeClient, isConnected: true });
  const expiresAt = new Date(Date.now() + 30_000);
  assert.equal(await service.dispatchHardwareCommand({ id, deviceId: 'board', source: 'feeding', action: 'TRIGGER', expiresAt }), true);
  assert.equal(publishes[0].topic, 'aquasense/board/command');
  assert.deepEqual(publishes[0].options, { qos: 1, retain: false });
  const command = parseSignedCommand(JSON.parse(publishes[0].payload));
  assert.ok(command);
  assert.equal(command.source, 'feeding'); assert.equal(command.action, 'TRIGGER'); assert.equal(command.durationMs, 0);
  assert.equal(verifyCanonical(commandCanonical(command), command.signature, 'test-device-secret'), true);
});

test('MQTT publish callback failure and disconnected broker are not device confirmation', async () => {
  config.device.keys = { board: 'test-device-secret' };
  const service = new MQTTService();
  const noPublish = Object.assign(service as unknown as object, { client: null, isConnected: false }) as unknown as MQTTService;
  assert.equal(await noPublish.dispatchHardwareCommand({ id, deviceId: 'board', source: 'hardware', action: 'ALL_OFF', expiresAt: new Date(Date.now() + 1000) }), false);
  const failingClient = { publish(_topic: string, _payload: string, _options: unknown, callback: (error?: Error) => void) { callback(new Error('broker publish failed')); } };
  Object.assign(service as unknown as object, { client: failingClient, isConnected: true });
  assert.equal(await service.dispatchHardwareCommand({ id, deviceId: 'board', source: 'hardware', action: 'ALL_OFF', expiresAt: new Date(Date.now() + 1000) }), false);
});

test('ORP preserves negative/zero millivolts and never turns absent values into zero', () => {
  assert.equal(parseOrp('-330.4'), -330.4); assert.equal(parseOrp(0), 0);
  for (const value of [null, undefined, '', ' ', true, {}, NaN, Infinity, 'bad']) assert.equal(parseOrp(value), null);
  assert.deepEqual(orpStatistics([{ orp: null }, { orp: -100 }, { orp: 300 }]),
    { parameter: 'ORP (mV)', current: null, average: 100, min: -100, max: 300 });
  assert.equal(orpStatistics([]).average, null);
});

test('integrated MQTT snapshot retains ORP and device identity through persistence and realtime delivery', async () => {
  mock.method(logger, 'info', () => {});
  const save = mock.method(sensorReadingService, 'ingest', async (deviceId:string, payload:Record<string,any>) => ({...payload, deviceId, do:null, doMeasured:false}));
  mock.method(sensorReadingService, 'getStatistics', async () => ({ orp: orpStatistics([{ orp: -330.4 }]) }));
  mock.method(waterAlertNotificationService, 'processReading', async () => undefined);
  const service = new MQTTService();
  let realtime: { orp?: number | null } | undefined;
  service.setRealtimeHandlers({ onReadingReceived: reading => { realtime = reading; } });
  await (service as unknown as { handleSensorReading(payload: string): Promise<void> }).handleSensorReading(
    JSON.stringify({ deviceId: 'board', temperature: 26, ph: 7, turbidity: 500, turbidityUnit: 'raw_adc', orp: -330.4 }));
  const args = save.mock.calls[0].arguments;
  assert.equal(args[0], 'board'); assert.equal(args[1].do, undefined); assert.equal(args[1].orp, -330.4);
  assert.equal(realtime?.orp, -330.4);
});

test('HTTP sync requires a configured matching key and active device even in development; user commands require ownership', async () => {
  config.device.keys = { board: 'test-key' };
  mock.method(logger, 'warn', () => {});
  mock.method(auditLogService, 'createLog', async () => null);
  mock.method(deviceService, 'getActiveDevice', async () => ({ userId: 'owner' }));
  const sync = mock.method(hardwareService, 'sync', async () => ({ command: null, schedules: [] }));
  const app = express(); app.use(express.json(), csrfProtection, hardwareRoutes);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + path,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    for (const headers of [{}, { 'x-device-key': 'wrong-key' }] as Array<Record<string, string>>) {
      assert.equal((await post('/hardware/device/sync', { deviceId: 'board', state }, headers)).status, 401);
    }
    assert.equal((await post('/hardware/device/sync', { deviceId: 'unknown', state }, { 'x-device-key': 'test-key' })).status, 401);
    const accepted = await post('/hardware/device/sync', { deviceId: 'board', state }, { 'x-device-key': 'test-key' });
    assert.equal(accepted.status, 200); assert.equal(sync.mock.callCount(), 1);
    assert.deepEqual(sync.mock.calls[0].arguments.slice(0, 2), ['owner', 'board']);
    mock.method(deviceService, 'getActiveDevice', async () => null);
    assert.equal((await post('/hardware/device/sync', { deviceId: 'board', state }, { 'x-device-key': 'test-key' })).status, 403);
    assert.equal((await post('/hardware/commands', { deviceId: 'board', action: 'ALL_OFF' })).status, 401);
    mock.method(tokenService, 'verifyToken', () => ({ userId: 'owner', email: 'test@example.test', role: 'farmer' }));
    mock.method(deviceService, 'verifyOwnership', async () => false);
    const expiry = new Date(Date.now() + 120_000);
    const queued = mock.method(hardwareService, 'queue', async () => ({ id, action: 'ALL_OFF', status: 'PENDING', result: null, expiresAt: expiry }));
    assert.equal((await post('/hardware/commands', { deviceId: 'board', action: 'ALL_OFF' }, { Authorization: 'Bearer test' })).status, 403);
    assert.equal(queued.mock.callCount(), 0);
    mock.method(deviceService, 'verifyOwnership', async () => true);
    const queueResponse = await post('/hardware/commands', { deviceId: 'board', action: 'ALL_OFF' }, { Authorization: 'Bearer test' });
    assert.equal(queueResponse.status, 202);
    const body = await queueResponse.json() as { data: { id: string; commandId: string; action: string; status: string; result: string | null; expiresAt: string; published: boolean } };
    assert.deepEqual(body.data, { id, commandId: id, action: 'ALL_OFF', status: 'PENDING', result: null, expiresAt: expiry.toISOString(), published: false });
    assert.equal(queued.mock.callCount(), 1);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
