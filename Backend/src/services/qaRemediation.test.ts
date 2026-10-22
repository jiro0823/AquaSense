import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import { thresholdPatchSchema, sensorIngestSchema, feedingDeviceAckSchema } from '../middleware/validate';
import { PredictionLog as PredictionLogModel } from '../database/models/PredictionLog';
import { predictionLogService } from './predictionLog.service';
import { Alert as AlertModel } from '../database/models/Alert';
import { alertService } from './alert.service';
import { tokenService } from '../utils/tokenService';
import { SensorReading as SensorReadingModel } from '../database/models/SensorReading';
import { SmsLog as SmsLogModel } from '../database/models/SmsLog';
import { sensorReadingService } from './sensorReadingService';
import { smsLogService } from './smsLogService';

afterEach(() => mock.restoreAll());

test('threshold and device payload schemas reject malformed values', () => {
  assert.equal(thresholdPatchSchema.safeParse({ temperature: { warning: 'hot' } }).success, false);
  assert.equal(thresholdPatchSchema.safeParse({ temperature: { min: 15, max: 35, warning: 30 } }).success, true);
  assert.equal(sensorIngestSchema.safeParse({ deviceId: 'board', ph: Number.NaN }).success, false);
  assert.equal(sensorIngestSchema.safeParse({ deviceId: 'board', ph: 'malformed' }).success, true);
  assert.equal(sensorIngestSchema.safeParse({ deviceId: 'board', turbidityUnit: 'unsupported' }).success, false);
  assert.equal(feedingDeviceAckSchema.safeParse({ deviceId: 'board', commandId: 'not-a-uuid' }).success, false);
  assert.equal(feedingDeviceAckSchema.safeParse({ deviceId: 'board', commandId: '9f2f2cbb-5e87-4bb3-a95e-c45d05de97d1' }).success, false);
  assert.equal(feedingDeviceAckSchema.safeParse({ v: 1, deviceId: 'board', id: '9f2f2cbb-5e87-4bb3-a95e-c45d05de97d1',
    source: 'feeding', action: 'TRIGGER', result: 'accepted', reportedAt: Date.now(),
    state: { fillPump: false, drainPump: false, aerator: false, feederBusy: false, buzzer: false, automation: false,
      waterPhase: 'IDLE', fault: '', relaysReady: false, timeValid: true, wifiConnected: true, mqttConnected: true, uptimeMs: 1 },
    signature: 'a'.repeat(64) }).success, true);
});

test('prediction history requests newest records first', async () => {
  let query: Record<string, unknown> | undefined;
  mock.method(PredictionLogModel, 'findAll', async (options: Record<string, unknown>) => {
    query = options;
    return [];
  });
  await predictionLogService.getRecentLogs(10);
  assert.deepEqual(query?.order, [['createdAt', 'DESC']]);
});

test('logout revokes the issued bearer token', () => {
  const token = tokenService.generateToken({ userId: 'user-1', email: 'user@example.com', role: 'farmer' });
  assert.ok(tokenService.verifyToken(token));
  tokenService.revokeToken(token);
  assert.equal(tokenService.verifyToken(token), null);
});

test('alert queries apply the caller device scope', async () => {
  let oneQuery: Record<string, unknown> | undefined;
  let manyQuery: Record<string, unknown> | undefined;
  mock.method(AlertModel, 'findOne', async (options: Record<string, unknown>) => { oneQuery = options; return null; });
  mock.method(AlertModel, 'findAll', async (options: Record<string, unknown>) => { manyQuery = options; return []; });
  await alertService.getAlertById('alert-1', ['device-a']);
  await alertService.getAlerts(10, undefined, ['device-a']);
  assert.deepEqual((oneQuery?.where as Record<string, unknown>).deviceId, { [Op.in]: ['device-a'] });
  assert.ok(manyQuery?.where);
});

test('sensor reading lookups and statistics apply the caller device scope', async () => {
  const queries: Array<Record<string, unknown>> = [];
  mock.method(SensorReadingModel, 'findOne', async (options: Record<string, unknown>) => { queries.push(options); return null; });
  mock.method(SensorReadingModel, 'findAll', async (options: Record<string, unknown>) => { queries.push(options); return []; });
  await sensorReadingService.getLatestReading(['device-a']);
  await sensorReadingService.getReadingsByTimeRange(60, ['device-a']);
  await sensorReadingService.getStatistics(60, ['device-a']);
  assert.deepEqual((queries[0].where as Record<string, unknown>).deviceId, { [Op.in]: ['device-a'] });
  assert.deepEqual((queries[1].where as Record<string, unknown>).deviceId, { [Op.in]: ['device-a'] });
  assert.deepEqual((queries[2].where as Record<string, unknown>).deviceId, { [Op.in]: ['device-a'] });
  assert.deepEqual((queries[3].where as Record<string, unknown>).deviceId, { [Op.in]: ['device-a'] });
});

test('empty device scope returns no water readings, predictions, or SMS logs', async () => {
  const readingQuery = mock.method(SensorReadingModel, 'findAll', async () => []);
  const predictionQuery = mock.method(PredictionLogModel, 'findAll', async () => []);
  const alertQuery = mock.method(AlertModel, 'findAll', async () => []);
  const smsQuery = mock.method(SmsLogModel, 'findAll', async () => []);
  assert.equal(await sensorReadingService.getLatestReading([]), null);
  assert.deepEqual(await sensorReadingService.getReadingsByTimeRange(60, []), []);
  assert.deepEqual(await predictionLogService.getRecentLogs(10, []), []);
  assert.deepEqual(await smsLogService.getRecentLogs(10, []), []);
  assert.equal(readingQuery.mock.callCount(), 0);
  assert.equal(predictionQuery.mock.callCount(), 0);
  assert.equal(alertQuery.mock.callCount(), 0);
  assert.equal(smsQuery.mock.callCount(), 0);
});

test('prediction history only returns logs linked to alerts for scoped devices', async () => {
  let alertOptions: Record<string, unknown> | undefined;
  let predictionOptions: Record<string, unknown> | undefined;
  mock.method(AlertModel, 'findAll', async (options: Record<string, unknown>) => {
    alertOptions = options;
    return [{ id: 'alert-a' }] as never[];
  });
  mock.method(PredictionLogModel, 'findAll', async (options: Record<string, unknown>) => {
    predictionOptions = options;
    return [];
  });
  await predictionLogService.getRecentLogs(10, ['device-a']);
  assert.deepEqual((alertOptions?.where as Record<string, unknown>).deviceId, { [Op.in]: ['device-a'] });
  assert.deepEqual((predictionOptions?.where as Record<string, unknown>).triggeredAlertId, { [Op.in]: ['alert-a'] });
});

test('SMS history applies the caller device scope', async () => {
  let query: Record<string, unknown> | undefined;
  mock.method(SmsLogModel, 'findAll', async (options: Record<string, unknown>) => { query = options; return []; });
  await smsLogService.getRecentLogs(10, ['device-a']);
  assert.deepEqual((query?.where as Record<string, unknown>).deviceId, { [Op.in]: ['device-a'] });
});
