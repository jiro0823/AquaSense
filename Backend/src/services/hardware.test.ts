import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { Op } from 'sequelize';
import hardwareRoutes from '../api/v1/routes/hardware';
import { hardwareCommandSchema, hardwareSyncSchema, type HardwareState } from './hardwareProtocol';
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

test('sync expires old work, bounds schedules, and prioritizes hardware over feeding', async () => {
  const expiry = mock.method(HardwareCommand, 'update', async () => [1]);
  const feedExpiry = mock.method(FeedingCommand, 'update', async () => [1]);
  mock.method(HardwareDeviceState, 'upsert', async () => [state, true]);
  mock.method(HardwareCommand, 'findOne', async () => ({ id, action: 'WATER_STOP', durationMs: null, expiresAt: new Date(Date.now() + 60000) }));
  mock.method(feedingService, 'getLatestDeviceCommand', async () => ({ id: 'feed', action: 'TRIGGER', createdAt: new Date() }));
  mock.method(feedingService, 'listSchedules', async () => Array.from({ length: 25 }, (_, i) => ({ id: String(i), enabled: i !== 0, time: '08:00', date: null })));
  const result = await hardwareService.sync('owner', 'board', state);
  assert.equal(result.command?.action, 'WATER_STOP');
  assert.ok(result.command!.ttlMs > 0 && result.command!.ttlMs <= 60000);
  assert.equal(result.schedules.length, 20); assert.equal(result.schedules[0].id, '1');
  const where = expiry.mock.calls[0].arguments[1]?.where as Record<string, any>;
  assert.ok(where.expiresAt[Op.lte] instanceof Date);
  assert.equal(feedExpiry.mock.callCount(), 1);
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
  const save = mock.method(sensorReadingService, 'addSensorReading', async () => null);
  mock.method(sensorReadingService, 'getStatistics', async () => ({ orp: orpStatistics([{ orp: -330.4 }]) }));
  mock.method(waterAlertNotificationService, 'processReading', async () => undefined);
  const service = new MQTTService();
  let realtime: { orp?: number | null } | undefined;
  service.setRealtimeHandlers({ onReadingReceived: reading => { realtime = reading; } });
  await (service as unknown as { handleSensorReading(payload: string): Promise<void> }).handleSensorReading(
    JSON.stringify({ deviceId: 'board', temperature: 26, ph: 7, turbidity: 500, turbidityUnit: 'raw_adc', orp: -330.4 }));
  const args = save.mock.calls[0].arguments;
  assert.equal(args[0], 'board'); assert.equal(args[8], false); assert.equal(args[9], -330.4);
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
    const queued = mock.method(hardwareService, 'queue', async () => ({ id }));
    assert.equal((await post('/hardware/commands', { deviceId: 'board', action: 'ALL_OFF' }, { Authorization: 'Bearer test' })).status, 403);
    assert.equal(queued.mock.callCount(), 0);
    mock.method(deviceService, 'verifyOwnership', async () => true);
    assert.equal((await post('/hardware/commands', { deviceId: 'board', action: 'ALL_OFF' }, { Authorization: 'Bearer test' })).status, 201);
    assert.equal(queued.mock.callCount(), 1);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
