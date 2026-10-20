import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { WaterQualityWebSocketServer } from './waterQualityWS';
import { tokenService } from '../utils/tokenService';
import { deviceService } from '../services/device.service';
import { sensorReadingService } from '../services/sensorReadingService';
import { alertService } from '../services/alert.service';

afterEach(() => mock.restoreAll());

type Handler = (...args: any[]) => unknown;

const stats = {
  orp: { current: null, average: null, min: null, max: null },
  temperature: { current: null, average: null, min: null, max: null },
  ph: { current: null, average: null, min: null, max: null },
  do: { current: null, average: null, min: null, max: null },
  turbidity: { current: null, average: null, min: null, max: null },
  ammonia: { current: null, average: null, min: null, max: null },
  healthScore: null,
};

const harness = () => {
  let middleware: Handler | undefined;
  let connection: Handler | undefined;
  const emittedRooms: Array<{ room: string; event: string; data: unknown }> = [];
  const io = {
    use: (fn: Handler) => { middleware = fn; },
    on: (event: string, fn: Handler) => { if (event === 'connection') connection = fn; },
    to: (room: string) => ({ emit: (event: string, data: unknown) => emittedRooms.push({ room, event, data }) }),
  };
  const server = Object.create(WaterQualityWebSocketServer.prototype) as Record<string, any>;
  server.io = io;
  server.connectedClients = new Set<string>();
  server.clientSockets = new Map<string, FakeSocket>();
  server.authRefreshes = new WeakMap<FakeSocket, Promise<boolean>>();
  server.setupEventHandlers();
  return { server, emittedRooms, authenticate: middleware!, connect: connection! };
};

type FakeSocket = {
  id: string;
  handshake: { auth?: Record<string, unknown>; headers: Record<string, string | undefined> };
  data: Record<string, unknown>;
  handlers: Map<string, Handler>;
  emissions: Array<{ event: string; data: unknown }>;
  rooms: string[];
  disconnected: boolean;
  on: (event: string, handler: Handler) => void;
  emit: (event: string, data: unknown) => void;
  join: (room: string) => Promise<void>;
  leave: (room: string) => Promise<void>;
  disconnect: (close?: boolean) => void;
};

const socket = (id: string, auth: FakeSocket['handshake']): FakeSocket => {
  const value = {
    id,
    handshake: auth,
    data: {} as Record<string, unknown>,
    handlers: new Map<string, Handler>(),
    emissions: [] as Array<{ event: string; data: unknown }>,
    rooms: [] as string[],
    disconnected: false,
    on(event: string, handler: Handler) { this.handlers.set(event, handler); },
    emit(event: string, data: unknown) { this.emissions.push({ event, data }); },
    async join(room: string) { this.rooms.push(room); },
    async leave(room: string) { this.rooms = this.rooms.filter((current) => current !== room); },
    disconnect() { this.disconnected = true; },
  };
  return value;
};

const authorize = (middleware: Handler, client: FakeSocket): Promise<void> => new Promise((resolve, reject) => {
  middleware(client, (error?: Error) => error ? reject(error) : resolve());
});

test('Socket.IO rejects missing and invalid authentication tokens', async () => {
  mock.method(tokenService, 'verifyToken', () => null);
  const { authenticate } = harness();
  await assert.rejects(authorize(authenticate, socket('missing', { headers: {} })), /Unauthorized/);
  await assert.rejects(authorize(authenticate, socket('invalid', { auth: { token: 'bad-token' }, headers: {} })), /Unauthorized/);
});

test('Socket.IO accepts cookie and Bearer tokens and scopes all client requests to active owned devices', async () => {
  mock.method(tokenService, 'verifyToken', (token: string) => token === 'cookie-token'
    ? { userId: 'user-a', email: 'a@example.test', role: 'farmer' }
    : token === 'bearer-token'
      ? { userId: 'user-b', email: 'b@example.test', role: 'farmer' }
      : null);
  mock.method(deviceService, 'listByUser', async (userId: string) => userId === 'user-a'
    ? [{ deviceId: 'device-a', isActive: true }, { deviceId: 'device-a2', isActive: true }, { deviceId: 'old-a', isActive: false }] as never
    : [{ deviceId: 'device-b', isActive: true }] as never);
  const readingCalls: Array<{ kind: string; deviceIds?: string[] }> = [];
  mock.method(sensorReadingService, 'getLatestReading', async (deviceIds?: string[]) => { readingCalls.push({ kind: 'latest', deviceIds }); return null; });
  mock.method(sensorReadingService, 'getReadingsByTimeRange', async (_minutes?: number, deviceIds?: string[]) => { readingCalls.push({ kind: 'history', deviceIds }); return []; });
  mock.method(sensorReadingService, 'getStatistics', async (_minutes?: number, deviceIds?: string[]) => { readingCalls.push({ kind: 'stats', deviceIds }); return stats as never; });
  const alertCalls: Array<string[] | undefined> = [];
  mock.method(alertService, 'getAlerts', async (_limit?: number, _status?: never, deviceIds?: string[]) => { alertCalls.push(deviceIds); return []; });

  const { authenticate, connect } = harness();
  const userA = socket('a', { headers: { cookie: 'aquasense_session=cookie-token' } });
  const userB = socket('b', { auth: { token: 'bearer-token' }, headers: { authorization: 'Bearer bearer-token' } });
  await authorize(authenticate, userA);
  await authorize(authenticate, userB);
  connect(userA);
  connect(userB);
  await new Promise((resolve) => setImmediate(resolve));
  readingCalls.length = 0;
  alertCalls.length = 0;

  assert.deepEqual(userA.rooms, ['water:device:device-a', 'water:device:device-a2']);
  assert.deepEqual(userB.rooms, ['water:device:device-b']);
  for (const client of [userA, userB]) {
    await client.handlers.get('water:request-latest')!();
    await client.handlers.get('water:request-history')!(45);
    await client.handlers.get('water:request-stats')!(45);
    await client.handlers.get('water:request-alerts')!(12);
  }
  assert.deepEqual(readingCalls.filter((call) => call.kind === 'latest').map((call) => call.deviceIds), [['device-a', 'device-a2'], ['device-b']]);
  assert.deepEqual(readingCalls.filter((call) => call.kind === 'history').map((call) => call.deviceIds), [['device-a', 'device-a2'], ['device-b']]);
  assert.deepEqual(readingCalls.filter((call) => call.kind === 'stats').map((call) => call.deviceIds), [['device-a', 'device-a2'], ['device-b']]);
  assert.deepEqual(alertCalls, [['device-a', 'device-a2'], ['device-b']]);
});

test('reading and alert broadcasts revalidate owners; stats are recomputed per owner', async () => {
  mock.method(tokenService, 'verifyToken', (token: string) => ({ userId: token, email: `${token}@example.test`, role: token === 'admin' ? 'admin' : 'farmer' }));
  mock.method(deviceService, 'listByUser', async (userId: string) => [{ deviceId: `device-${userId}`, isActive: true }] as never);
  const scopedStatsCalls: Array<string[] | undefined> = [];
  mock.method(sensorReadingService, 'getLatestReading', async () => null);
  mock.method(sensorReadingService, 'getReadingsByTimeRange', async () => []);
  mock.method(sensorReadingService, 'getStatistics', async (_minutes?: number, deviceIds?: string[]) => { scopedStatsCalls.push(deviceIds); return stats as never; });
  const { server, authenticate, connect } = harness();
  const ownerA = socket('a', { auth: { token: 'owner-a' }, headers: {} });
  const ownerB = socket('b', { auth: { token: 'owner-b' }, headers: {} });
  const admin = socket('admin', { auth: { token: 'admin' }, headers: {} });
  for (const client of [ownerA, ownerB, admin]) {
    await authorize(authenticate, client);
    connect(client);
  }

  server.broadcastReading({ deviceId: 'device-owner-a', ph: 7 });
  server.broadcastAlert({ deviceId: 'device-owner-a', id: 'alert-a' });
  server.broadcastStats({ forgedGlobalStats: true });
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(ownerA.emissions.some((entry) => entry.event === 'water:new-reading'));
  assert.ok(ownerA.emissions.some((entry) => entry.event === 'water:alert'));
  assert.equal(ownerB.emissions.some((entry) => ['water:new-reading', 'water:alert'].includes(entry.event)), false);
  assert.ok(admin.emissions.some((entry) => entry.event === 'water:new-reading'));
  assert.ok(admin.emissions.some((entry) => entry.event === 'water:alert'));
  assert.ok(admin.emissions.some((entry) => entry.event === 'water:stats-update' && (entry.data as { forgedGlobalStats?: boolean }).forgedGlobalStats === true));
  assert.equal(scopedStatsCalls.filter((ids) => ids?.[0] === 'device-owner-a').length, 2);
  assert.equal(scopedStatsCalls.filter((ids) => ids?.[0] === 'device-owner-b').length, 2);
  assert.equal(scopedStatsCalls.filter((ids) => ids === undefined).length, 1);
  assert.ok(ownerA.emissions.some((entry) => entry.event === 'water:stats-update'));
  assert.ok(ownerB.emissions.some((entry) => entry.event === 'water:stats-update'));
  assert.ok(ownerA.emissions.every((entry) => !JSON.stringify(entry.data).includes('forgedGlobalStats')));
});

test('revoked sessions disconnect and device transfer refreshes rooms before broadcasts', async () => {
  let revoked = false;
  let expired = false;
  let deviceId = 'device-a';
  mock.method(tokenService, 'verifyToken', (token: string) => ((token === 'revoked-token' && revoked) || (token === 'expired-token' && expired))
    ? null
    : { userId: 'user-a', email: 'a@example.test', role: 'farmer' });
  mock.method(deviceService, 'listByUser', async () => [{ deviceId, isActive: true }] as never);
  const { server, authenticate, connect } = harness();
  const transferred = socket('transfer', { auth: { token: 'user-token' }, headers: {} });
  const loggedOut = socket('logout', { auth: { token: 'revoked-token' }, headers: {} });
  const expiredSession = socket('expired', { auth: { token: 'expired-token' }, headers: {} });
  await authorize(authenticate, transferred);
  await authorize(authenticate, loggedOut);
  await authorize(authenticate, expiredSession);
  connect(transferred);
  connect(loggedOut);
  connect(expiredSession);
  await new Promise((resolve) => setImmediate(resolve));
  transferred.emissions.length = 0;
  loggedOut.emissions.length = 0;

  deviceId = 'device-b';
  server.broadcastReading({ deviceId: 'device-a', value: 'old-owner-data' });
  await new Promise((resolve) => setImmediate(resolve));
  revoked = true;
  expired = true;
  server.broadcastAlert({ deviceId: 'device-a', id: 'private-alert' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(transferred.rooms, ['water:device:device-b']);
  assert.equal(transferred.emissions.some((entry) => entry.event === 'water:new-reading' || entry.event === 'water:alert'), false);
  assert.equal(loggedOut.disconnected, true);
  assert.equal(expiredSession.disconnected, true);
  assert.equal(loggedOut.emissions.some((entry) => entry.event === 'water:alert'), false);
});

test('Socket.IO rejects out-of-range and non-finite minutes/limits before querying data', async () => {
  mock.method(tokenService, 'verifyToken', () => ({ userId: 'user-a', email: 'a@example.test', role: 'farmer' }));
  mock.method(deviceService, 'listByUser', async () => [{ deviceId: 'device-a', isActive: true }] as never);
  let queryCount = 0;
  mock.method(sensorReadingService, 'getLatestReading', async () => null);
  mock.method(sensorReadingService, 'getReadingsByTimeRange', async () => { queryCount += 1; return []; });
  mock.method(sensorReadingService, 'getStatistics', async () => { queryCount += 1; return stats as never; });
  mock.method(alertService, 'getAlerts', async () => { queryCount += 1; return []; });
  const { authenticate, connect } = harness();
  const client = socket('invalid-args', { auth: { token: 'token' }, headers: {} });
  await authorize(authenticate, client);
  connect(client);
  await new Promise((resolve) => setImmediate(resolve));
  client.emissions.length = 0;
  queryCount = 0;

  for (const invalidMinutes of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1441]) {
    await client.handlers.get('water:request-history')!(invalidMinutes);
    await client.handlers.get('water:request-stats')!(invalidMinutes);
  }
  for (const invalidLimit of [-1, Number.NaN, Number.POSITIVE_INFINITY, 201]) {
    await client.handlers.get('water:request-alerts')!(invalidLimit);
  }

  assert.equal(queryCount, 0);
  assert.equal(client.emissions.filter((entry) => entry.event === 'error').length, 12);
  assert.equal(client.emissions.some((entry) => ['water:history', 'water:stats', 'water:alerts'].includes(entry.event)), false);
});

test('Socket.IO reports latest/history/stats/alert query failures without rejected handler promises', async () => {
  mock.method(tokenService, 'verifyToken', () => ({ userId: 'user-a', email: 'a@example.test', role: 'farmer' }));
  mock.method(deviceService, 'listByUser', async () => [{ deviceId: 'device-a', isActive: true }] as never);
  mock.method(sensorReadingService, 'getLatestReading', async () => { throw new Error('latest storage failed'); });
  mock.method(sensorReadingService, 'getReadingsByTimeRange', async () => { throw new Error('history storage failed'); });
  mock.method(sensorReadingService, 'getStatistics', async () => { throw new Error('stats storage failed'); });
  mock.method(alertService, 'getAlerts', async () => { throw new Error('alerts storage failed'); });
  const { authenticate, connect } = harness();
  const client = socket('query-errors', { auth: { token: 'token' }, headers: {} });
  await authorize(authenticate, client);
  connect(client);
  await new Promise((resolve) => setImmediate(resolve));
  client.emissions.length = 0;

  await client.handlers.get('water:request-latest')!();
  await client.handlers.get('water:request-history')!(60);
  await client.handlers.get('water:request-stats')!(60);
  await client.handlers.get('water:request-alerts')!(50);

  assert.deepEqual(client.emissions.map((entry) => entry.event), ['error', 'error', 'error', 'error']);
  assert.deepEqual(client.emissions.map((entry) => (entry.data as { message: string }).message), [
    'Failed to get latest reading',
    'Failed to get history',
    'Failed to get statistics',
    'Failed to get alerts',
  ]);
});
