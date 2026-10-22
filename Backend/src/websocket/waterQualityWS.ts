/**
 * WebSocket Server for Real-time Water Quality Monitoring
 * Using Socket.io for real-time communication
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { sensorReadingService } from '../services/sensorReadingService';
import { alertService } from '../services/alert.service';
import type { WaterQualityStats } from '../iot/water/types';
import { config } from '../config/config';
import { tokenService } from '../utils/tokenService';
import { deviceService } from '../services/device.service';

const ADMIN_ROOM = 'water:admins';
const deviceRoom = (deviceId: string): string => `water:device:${deviceId}`;
const sameDeviceScope = (left?: string[], right?: string[]): boolean => {
  if (left === undefined || right === undefined) return left === right;
  return left.length === right.length && left.every((id) => right.includes(id));
};
const parseBoundedInteger = (value: unknown, fallback: number, min: number, max: number): number | null => {
  const candidate = value === undefined ? fallback : value;
  return typeof candidate === 'number' && Number.isFinite(candidate) && Number.isInteger(candidate) && candidate >= min && candidate <= max
    ? candidate
    : null;
};

const handshakeToken = (socket: Socket): string | undefined => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();
  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === 'string' && /^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, '').trim() || undefined;
  }
  const cookieHeader = socket.handshake.headers.cookie;
  if (typeof cookieHeader !== 'string') return undefined;
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${config.authCookie.name}=`));
  if (!cookie) return undefined;
  try { return decodeURIComponent(cookie.slice(config.authCookie.name.length + 1)); } catch { return undefined; }
};

class WaterQualityWebSocketServer {
  private io: SocketIOServer;
  private connectedClients = new Set<string>();
  private clientSockets = new Map<string, Socket>();
  private authRefreshes = new WeakMap<Socket, Promise<boolean>>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.startDataSimulation();
    logger.info('Socket.io WebSocket server initialized');
  }

  /**
   * Setup all WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.use((socket, next) => {
      void (async () => {
        const token = handshakeToken(socket);
        const payload = token ? tokenService.verifyToken(token) : null;
        if (!payload?.userId || !['admin', 'farmer', 'guest'].includes(payload.role || 'farmer')) {
          next(new Error('Unauthorized'));
          return;
        }

        const role = payload.role || 'farmer';
        const deviceIds = role === 'admin'
          ? undefined
          : (await deviceService.listByUser(payload.userId)).filter((device) => device.isActive).map((device) => device.deviceId);
        socket.data.userId = payload.userId;
        socket.data.userRole = role;
        socket.data.deviceIds = deviceIds;
        socket.data.authToken = token;
        next();
      })().catch((error) => {
        logger.warn('Socket.IO authentication failed', error);
        next(new Error('Unauthorized'));
      });
    });

    this.io.on('connection', (socket: Socket) => {
      this.connectedClients.add(socket.id);
      this.clientSockets.set(socket.id, socket);
      if (socket.data.userRole === 'admin') void socket.join(ADMIN_ROOM);
      else for (const deviceId of socket.data.deviceIds as string[]) void socket.join(deviceRoom(deviceId));
      logger.info(`Water quality client connected: ${socket.id}`, {
        totalClients: this.connectedClients.size,
      });

      void this.emitSnapshot(socket, 60);

      // Handle client events
      socket.on('water:request-latest', async () => {
        try {
          if (!await this.refreshSocketAuthorization(socket)) return;
          const deviceIds = socket.data.deviceIds as string[] | undefined;
          const latest = await sensorReadingService.getLatestReading(deviceIds);
          if (!await this.refreshSocketAuthorization(socket)) return;
          if (!sameDeviceScope(deviceIds, socket.data.deviceIds as string[] | undefined)) return;
          socket.emit('water:latest', latest);
        } catch (error) {
          logger.warn('Failed to retrieve latest websocket reading', error);
          socket.emit('error', { message: 'Failed to get latest reading' });
        }
      });

      socket.on('water:request-stats', async (input: unknown) => {
        const minutes = parseBoundedInteger(input, 60, 1, 1440);
        if (minutes === null) {
          socket.emit('error', { message: 'minutes must be an integer from 1 to 1440' });
          return;
        }
        try {
          if (!await this.refreshSocketAuthorization(socket)) return;
          const deviceIds = socket.data.deviceIds as string[] | undefined;
          const stats = await this.getDbBackedStats(minutes, deviceIds);
          if (!await this.refreshSocketAuthorization(socket)) return;
          if (!sameDeviceScope(deviceIds, socket.data.deviceIds as string[] | undefined)) return;
          socket.emit('water:stats', stats);
        } catch (error) {
          logger.warn('Failed to retrieve websocket statistics', error);
          socket.emit('error', { message: 'Failed to get statistics' });
        }
      });

      socket.on('water:request-alerts', async (input: unknown) => {
        const limit = parseBoundedInteger(input, 50, 1, 200);
        if (limit === null) {
          socket.emit('error', { message: 'limit must be an integer from 1 to 200' });
          return;
        }
        try {
          if (!await this.refreshSocketAuthorization(socket)) return;
          const deviceIds = socket.data.deviceIds as string[] | undefined;
          const alerts = await alertService.getAlerts(limit, undefined, deviceIds);
          if (!await this.refreshSocketAuthorization(socket)) return;
          if (!sameDeviceScope(deviceIds, socket.data.deviceIds as string[] | undefined)) return;
          socket.emit('water:alerts', alerts);
        } catch (error) {
          logger.warn('Failed to retrieve websocket alerts', error);
          socket.emit('error', { message: 'Failed to get alerts' });
        }
      });

      socket.on('water:request-history', async (input: unknown) => {
        const minutes = parseBoundedInteger(input, 60, 1, 1440);
        if (minutes === null) {
          socket.emit('error', { message: 'minutes must be an integer from 1 to 1440' });
          return;
        }
        try {
          if (!await this.refreshSocketAuthorization(socket)) return;
          const deviceIds = socket.data.deviceIds as string[] | undefined;
          const history = await sensorReadingService.getReadingsByTimeRange(minutes, deviceIds);
          if (!await this.refreshSocketAuthorization(socket)) return;
          if (!sameDeviceScope(deviceIds, socket.data.deviceIds as string[] | undefined)) return;
          socket.emit('water:history', history);
        } catch (error) {
          logger.warn('Failed to retrieve websocket history', error);
          socket.emit('error', { message: 'Failed to get history' });
        }
      });

      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id);
        this.clientSockets.delete(socket.id);
        logger.info(`Water quality client disconnected: ${socket.id}`, {
          totalClients: this.connectedClients.size,
        });
      });
    });
  }

  /** Recheck revocation and current device ownership before returning protected data. */
  private async refreshSocketAuthorization(socket: Socket): Promise<boolean> {
    const inFlight = this.authRefreshes.get(socket);
    if (inFlight) return inFlight;
    const refresh = this.performSocketAuthorizationRefresh(socket);
    this.authRefreshes.set(socket, refresh);
    try {
      return await refresh;
    } finally {
      if (this.authRefreshes.get(socket) === refresh) this.authRefreshes.delete(socket);
    }
  }

  private async performSocketAuthorizationRefresh(socket: Socket): Promise<boolean> {
    const token = socket.data.authToken;
    const payload = typeof token === 'string' ? tokenService.verifyToken(token) : null;
    if (!payload?.userId || payload.userId !== socket.data.userId) {
      socket.disconnect(true);
      return false;
    }

    const role = payload.role || 'farmer';
    if (!['admin', 'farmer', 'guest'].includes(role)) {
      socket.disconnect(true);
      return false;
    }
    const deviceIds = role === 'admin'
      ? undefined
      : (await deviceService.listByUser(payload.userId)).filter((device) => device.isActive).map((device) => device.deviceId);
    const previousIds = socket.data.deviceIds as string[] | undefined;
    const oldRooms = new Set((previousIds || []).map(deviceRoom));
    const newRooms = new Set((deviceIds || []).map(deviceRoom));
    for (const room of oldRooms) if (!newRooms.has(room)) await socket.leave(room);
    for (const room of newRooms) if (!oldRooms.has(room)) await socket.join(room);
    if (socket.data.userRole === 'admin' && role !== 'admin') await socket.leave(ADMIN_ROOM);
    if (socket.data.userRole !== 'admin' && role === 'admin') await socket.join(ADMIN_ROOM);
    socket.data.userRole = role;
    socket.data.deviceIds = deviceIds;
    return true;
  }

  private async emitSnapshot(socket: Socket, minutes: number): Promise<void> {
    try {
      if (!await this.refreshSocketAuthorization(socket)) return;
      const deviceIds = socket.data.deviceIds as string[] | undefined;
      const latest = await sensorReadingService.getLatestReading(deviceIds);
      if (!await this.refreshSocketAuthorization(socket)) return;
      if (!sameDeviceScope(deviceIds, socket.data.deviceIds as string[] | undefined)) return;
      socket.emit('water:latest', latest);

      const stats = await this.getDbBackedStats(minutes, deviceIds);
      if (!await this.refreshSocketAuthorization(socket)) return;
      if (!sameDeviceScope(deviceIds, socket.data.deviceIds as string[] | undefined)) return;
      socket.emit('water:stats', stats);

      const history = await sensorReadingService.getReadingsByTimeRange(minutes, deviceIds);
      if (!await this.refreshSocketAuthorization(socket)) return;
      if (!sameDeviceScope(deviceIds, socket.data.deviceIds as string[] | undefined)) return;
      socket.emit('water:history', history);
    } catch (error) {
      logger.warn('Failed to emit websocket snapshot', error);
    }
  }

  private async getDbBackedStats(minutes: number, deviceIds?: string[]): Promise<WaterQualityStats> {
    const dbStats = await sensorReadingService.getStatistics(minutes, deviceIds);
    return {
      timestamp: new Date(),
    orp: dbStats.orp,
      temperature: {
        current: dbStats.temperature.current,
        average: dbStats.temperature.average,
        min: dbStats.temperature.min,
        max: dbStats.temperature.max,
      },
      ph: {
        current: dbStats.ph.current,
        average: dbStats.ph.average,
        min: dbStats.ph.min,
        max: dbStats.ph.max,
      },
      do: {
        current: dbStats.do.current,
        average: dbStats.do.average,
        min: dbStats.do.min,
        max: dbStats.do.max,
      },
      turbidity: {
        current: dbStats.turbidity.current,
        average: dbStats.turbidity.average,
        min: dbStats.turbidity.min,
        max: dbStats.turbidity.max,
      },
      ammonia: {
        current: dbStats.ammonia.current,
        average: dbStats.ammonia.average,
        min: dbStats.ammonia.min,
        max: dbStats.ammonia.max,
      },
      healthScore: dbStats.healthScore,
    };
  }

  /**
   * Broadcast new reading to all connected clients
   */
  broadcastReading(reading: any): void {
    if (typeof reading?.deviceId !== 'string') return;
    for (const socket of this.clientSockets.values()) {
      void this.refreshSocketAuthorization(socket)
        .then((valid) => {
          if (valid && (socket.data.userRole === 'admin' || (socket.data.deviceIds as string[]).includes(reading.deviceId))) {
            socket.emit('water:new-reading', reading);
          }
        })
        .catch((error) => logger.warn('Failed to revalidate reading broadcast recipient', error));
    }
  }

  /**
   * Broadcast alert to all connected clients
   */
  broadcastAlert(alert: any): void {
    if (typeof alert?.deviceId !== 'string') return;
    for (const socket of this.clientSockets.values()) {
      void this.refreshSocketAuthorization(socket)
        .then((valid) => {
          if (valid && (socket.data.userRole === 'admin' || (socket.data.deviceIds as string[]).includes(alert.deviceId))) {
            socket.emit('water:alert', alert);
          }
        })
        .catch((error) => logger.warn('Failed to revalidate alert broadcast recipient', error));
    }
  }

  /**
   * Broadcast statistics update
   */
  broadcastStats(stats: any): void {
    for (const socket of this.clientSockets.values()) {
      void this.refreshSocketAuthorization(socket)
        .then(async (valid) => {
          if (!valid) return;
          if (socket.data.userRole === 'admin') {
            socket.emit('water:stats-update', stats);
            return;
          }
          const scopedDeviceIds = socket.data.deviceIds as string[];
          const scopedStats = await this.getDbBackedStats(60, scopedDeviceIds);
          if (await this.refreshSocketAuthorization(socket) && socket.data.userRole !== 'admin') {
            if (!sameDeviceScope(scopedDeviceIds, socket.data.deviceIds as string[] | undefined)) return;
            socket.emit('water:stats-update', scopedStats);
          }
        })
        .catch((error) => logger.warn('Failed to emit scoped websocket statistics', error));
    }
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  public close(): Promise<void> {
    return new Promise((resolve) => this.io.close(() => resolve()));
  }

  /**
   * Placeholder for data simulation
   * In production, this will receive data from ESP32 IoT device via HTTP POST to /api/v1/water/readings
   * For now, this method is a no-op to keep the system in preparation mode
   * 
   * FUTURE: When ESP32 is connected, remove this method and handle data via POST endpoints
   */
  private startDataSimulation(): void {
    // Preparation mode: no data simulation
    // Real data will come from:
    // 1. HTTP POST /api/v1/water/readings (from ESP32)
    // 2. MQTT broker (optional)
    // 3. Direct database polling
    
    const baseUrl = `http://${config.server.host}:${config.server.port}`;
    logger.info('✓ Backend in preparation mode - ready to receive ESP32 sensor data via API');
    logger.info(`✓ ESP32 should POST to: ${baseUrl}/api/v1/water/readings`);
    logger.info('✓ Request format: { temperature, ph, do, turbidity, location, timestamp }');
  }
}

export { WaterQualityWebSocketServer };
