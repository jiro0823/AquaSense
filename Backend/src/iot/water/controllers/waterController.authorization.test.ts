import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../middleware/authMiddleware';
import { authenticateToken } from '../../../middleware/authMiddleware';
import {
  getDashboardData,
  getLatestReading,
  getPredictionHistory,
  getReadingsByTimeRange,
  getStatistics,
} from './waterController';
import { deviceService } from '../../../services/device.service';
import { sensorReadingService } from '../../../services/sensorReadingService';
import { alertService } from '../../../services/alert.service';
import { predictionLogService } from '../../../services/predictionLog.service';
import { smsLogService } from '../../../services/smsLogService';
import { predictiveAnalyticsService } from '../../../services/predictiveAnalytics.service';
import { waterQualityService } from '../services/waterQualityService';

afterEach(() => mock.restoreAll());

const stats = {
  orp: { current: null, average: null, min: null, max: null },
  temperature: { current: null, average: null, min: null, max: null },
  ph: { current: null, average: null, min: null, max: null },
  do: { current: null, average: null, min: null, max: null },
  turbidity: { current: null, average: null, min: null, max: null },
  ammonia: { current: null, average: null, min: null, max: null },
  healthScore: null,
};

const request = (userId?: string, userRole: 'admin' | 'farmer' | 'guest' = 'farmer'): AuthenticatedRequest => ({
  userId,
  userRole,
  query: {},
} as unknown as AuthenticatedRequest);

const response = (): Response => {
  const res: Record<string, unknown> = {};
  res.status = () => res;
  res.json = () => res;
  return res as unknown as Response;
};

const installServiceMocks = (calls: {
  latest: Array<string[] | undefined>;
  history: Array<string[] | undefined>;
  statistics: Array<string[] | undefined>;
  alerts: Array<string[] | undefined>;
  predictions: Array<string[] | undefined>;
  sms: Array<string[] | undefined>;
}) => {
  mock.method(deviceService, 'listByUser', async (userId: string) => userId === 'user-a'
    ? [{ deviceId: 'device-a1', isActive: true }, { deviceId: 'device-a-old', isActive: false }] as never
    : [{ deviceId: 'device-b1', isActive: true }] as never);
  mock.method(sensorReadingService, 'getLatestReading', async (deviceIds?: string[]) => { calls.latest.push(deviceIds); return null; });
  mock.method(sensorReadingService, 'getReadingsByTimeRange', async (_minutes?: number, deviceIds?: string[]) => { calls.history.push(deviceIds); return []; });
  mock.method(sensorReadingService, 'getStatistics', async (_minutes?: number, deviceIds?: string[]) => { calls.statistics.push(deviceIds); return stats as never; });
  mock.method(alertService, 'getAlerts', async (_limit?: number, _status?: never, deviceIds?: string[]) => { calls.alerts.push(deviceIds); return []; });
  mock.method(predictionLogService, 'getRecentLogs', async (_limit?: number, deviceIds?: string[]) => { calls.predictions.push(deviceIds); return []; });
  mock.method(smsLogService, 'getRecentLogs', async (_limit?: number, deviceIds?: string[]) => { calls.sms.push(deviceIds); return []; });
  mock.method(predictiveAnalyticsService, 'getWarningCard', async () => ({}) as never);
  mock.method(waterQualityService, 'getThresholds', () => ({} as never));
};

const callAllReadControllers = async (userId?: string, userRole: 'admin' | 'farmer' | 'guest' = 'farmer') => {
  const calls = { latest: [], history: [], statistics: [], alerts: [], predictions: [], sms: [] } as {
    latest: Array<string[] | undefined>;
    history: Array<string[] | undefined>;
    statistics: Array<string[] | undefined>;
    alerts: Array<string[] | undefined>;
    predictions: Array<string[] | undefined>;
    sms: Array<string[] | undefined>;
  };
  installServiceMocks(calls);
  const req = request(userId, userRole);
  await getLatestReading(req, response());
  await getReadingsByTimeRange(req, response());
  await getStatistics(req, response());
  await getDashboardData(req, response());
  await getPredictionHistory(req, response());
  return calls;
};

test('water read controllers resolve data against only the authenticated user’s active devices', async () => {
  const userA = await callAllReadControllers('user-a');
  assert.deepEqual(userA.latest, [['device-a1'], ['device-a1']]);
  assert.deepEqual(userA.history, [['device-a1']]);
  assert.deepEqual(userA.statistics, [['device-a1'], ['device-a1']]);
  assert.deepEqual(userA.alerts, [['device-a1']]);
  assert.deepEqual(userA.predictions, [['device-a1'], ['device-a1']]);
  assert.deepEqual(userA.sms, [['device-a1']]);

  const userB = await callAllReadControllers('user-b');
  assert.deepEqual(userB.latest, [['device-b1'], ['device-b1']]);
  assert.deepEqual(userB.history, [['device-b1']]);
  assert.deepEqual(userB.statistics, [['device-b1'], ['device-b1']]);
  assert.deepEqual(userB.alerts, [['device-b1']]);
  assert.deepEqual(userB.predictions, [['device-b1'], ['device-b1']]);
  assert.deepEqual(userB.sms, [['device-b1']]);
});

test('water read controllers fail closed when the authenticated request has no user ID', async () => {
  const calls = await callAllReadControllers();
  assert.deepEqual(calls.latest, [[], []]);
  assert.deepEqual(calls.history, [[]]);
  assert.deepEqual(calls.statistics, [[], []]);
  assert.deepEqual(calls.alerts, [[]]);
  assert.deepEqual(calls.predictions, [[], []]);
  assert.deepEqual(calls.sms, [[]]);
});

test('guest water readers are scoped to their active devices', async () => {
  const guest = await callAllReadControllers('user-a', 'guest');
  assert.deepEqual(guest.latest, [['device-a1'], ['device-a1']]);
  assert.deepEqual(guest.history, [['device-a1']]);
  assert.deepEqual(guest.statistics, [['device-a1'], ['device-a1']]);
  assert.deepEqual(guest.alerts, [['device-a1']]);
  assert.deepEqual(guest.predictions, [['device-a1'], ['device-a1']]);
  assert.deepEqual(guest.sms, [['device-a1']]);
});

test('missing water API authentication is rejected before controller access', () => {
  let nextCalls = 0;
  let statusCode = 0;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json() { return this; },
  } as never;
  authenticateToken({ headers: {} } as never, res, () => { nextCalls += 1; });
  assert.equal(statusCode, 401);
  assert.equal(nextCalls, 0);
});
