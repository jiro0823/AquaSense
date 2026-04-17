/**
 * WebSocket Server for Real-time Water Quality Monitoring
 * Using Socket.io for real-time communication
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';
import { waterQualityService } from '../iot/water/services/waterQualityService';

class WaterQualityWebSocketServer {
  private io: SocketIOServer;
  private connectedClients = new Set<string>();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:5000'],
        methods: ['GET', 'POST'],
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
    this.io.on('connection', (socket: Socket) => {
      this.connectedClients.add(socket.id);
      logger.info(`Water quality client connected: ${socket.id}`, {
        totalClients: this.connectedClients.size,
      });

      // Send latest reading on connection
      const latest = waterQualityService.getLatestReading();
      if (latest) {
        socket.emit('water:latest', latest);
      }

      // Send current statistics
      try {
        const stats = waterQualityService.getStatistics(60);
        socket.emit('water:stats', stats);
      } catch {
        logger.debug('No stats available yet');
      }

      // Handle client events
      socket.on('water:request-latest', () => {
        const latest = waterQualityService.getLatestReading();
        socket.emit('water:latest', latest);
      });

      socket.on('water:request-stats', (minutes: number) => {
        try {
          const stats = waterQualityService.getStatistics(minutes || 60);
          socket.emit('water:stats', stats);
        } catch (error) {
          socket.emit('error', { message: 'Failed to get statistics' });
        }
      });

      socket.on('water:request-alerts', (limit: number) => {
        const alerts = waterQualityService.getAlerts(limit || 50);
        socket.emit('water:alerts', alerts);
      });

      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id);
        logger.info(`Water quality client disconnected: ${socket.id}`, {
          totalClients: this.connectedClients.size,
        });
      });
    });
  }

  /**
   * Broadcast new reading to all connected clients
   */
  broadcastReading(reading: any): void {
    this.io.emit('water:new-reading', reading);
  }

  /**
   * Broadcast alert to all connected clients
   */
  broadcastAlert(alert: any): void {
    this.io.emit('water:alert', alert);
  }

  /**
   * Broadcast statistics update
   */
  broadcastStats(stats: any): void {
    this.io.emit('water:stats-update', stats);
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
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
    
    logger.info('✓ Backend in preparation mode - ready to receive ESP32 sensor data via API');
    logger.info('✓ ESP32 should POST to: http://localhost:5000/api/v1/water/readings');
    logger.info('✓ Request format: { temperature, ph, do, turbidity, location, timestamp }');
  }
}

export { WaterQualityWebSocketServer };
