"use strict";
/**
 * WebSocket Server for Real-time Water Quality Monitoring
 * Using Socket.io for real-time communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaterQualityWebSocketServer = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = require("../utils/logger");
const waterQualityService_1 = require("../iot/water/services/waterQualityService");
const sensorReadingService_1 = require("../services/sensorReadingService");
const config_1 = require("../config/config");
class WaterQualityWebSocketServer {
    constructor(httpServer) {
        this.connectedClients = new Set();
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: config_1.config.cors.origin,
                methods: ['GET', 'POST'],
            },
            transports: ['websocket', 'polling'],
        });
        this.setupEventHandlers();
        this.startDataSimulation();
        logger_1.logger.info('Socket.io WebSocket server initialized');
    }
    /**
     * Setup all WebSocket event handlers
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            this.connectedClients.add(socket.id);
            logger_1.logger.info(`Water quality client connected: ${socket.id}`, {
                totalClients: this.connectedClients.size,
            });
            void this.emitSnapshot(socket, 60);
            // Handle client events
            socket.on('water:request-latest', async () => {
                const latest = await sensorReadingService_1.sensorReadingService.getLatestReading();
                socket.emit('water:latest', latest);
            });
            socket.on('water:request-stats', async (minutes) => {
                try {
                    const stats = await this.getDbBackedStats(minutes || 60);
                    socket.emit('water:stats', stats);
                }
                catch (error) {
                    socket.emit('error', { message: 'Failed to get statistics' });
                }
            });
            socket.on('water:request-alerts', (limit) => {
                const alerts = waterQualityService_1.waterQualityService.getAlerts(limit || 50);
                socket.emit('water:alerts', alerts);
            });
            socket.on('water:request-history', async (minutes) => {
                const history = await sensorReadingService_1.sensorReadingService.getReadingsByTimeRange(minutes || 60);
                socket.emit('water:history', history);
            });
            socket.on('disconnect', () => {
                this.connectedClients.delete(socket.id);
                logger_1.logger.info(`Water quality client disconnected: ${socket.id}`, {
                    totalClients: this.connectedClients.size,
                });
            });
        });
    }
    async emitSnapshot(socket, minutes) {
        try {
            const latest = await sensorReadingService_1.sensorReadingService.getLatestReading();
            socket.emit('water:latest', latest);
            const stats = await this.getDbBackedStats(minutes);
            socket.emit('water:stats', stats);
            const history = await sensorReadingService_1.sensorReadingService.getReadingsByTimeRange(minutes);
            socket.emit('water:history', history);
        }
        catch (error) {
            logger_1.logger.warn('Failed to emit websocket snapshot', error);
        }
    }
    async getDbBackedStats(minutes) {
        const dbStats = await sensorReadingService_1.sensorReadingService.getStatistics(minutes);
        return {
            timestamp: new Date(),
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
            healthScore: this.calculateHealthScore(dbStats.temperature.current, dbStats.ph.current, dbStats.do.current, dbStats.turbidity.current),
        };
    }
    calculateHealthScore(temperature, ph, dissolvedOxygen, turbidity) {
        let score = 100;
        if (temperature < 15 || temperature > 35) {
            score -= 20;
        }
        else if (temperature > 30) {
            score -= 10;
        }
        if (ph < 6.5 || ph > 8.5) {
            score -= 25;
        }
        else if (ph < 7.0 || ph > 8.0) {
            score -= 10;
        }
        if (dissolvedOxygen < 3) {
            score -= 30;
        }
        else if (dissolvedOxygen < 5) {
            score -= 15;
        }
        else if (dissolvedOxygen < 8) {
            score -= 5;
        }
        if (turbidity > 100) {
            score -= 20;
        }
        else if (turbidity > 50) {
            score -= 10;
        }
        return Math.max(0, score);
    }
    /**
     * Broadcast new reading to all connected clients
     */
    broadcastReading(reading) {
        this.io.emit('water:new-reading', reading);
    }
    /**
     * Broadcast alert to all connected clients
     */
    broadcastAlert(alert) {
        this.io.emit('water:alert', alert);
    }
    /**
     * Broadcast statistics update
     */
    broadcastStats(stats) {
        this.io.emit('water:stats-update', stats);
    }
    /**
     * Get connected clients count
     */
    getConnectedClientsCount() {
        return this.connectedClients.size;
    }
    /**
     * Placeholder for data simulation
     * In production, this will receive data from ESP32 IoT device via HTTP POST to /api/v1/water/readings
     * For now, this method is a no-op to keep the system in preparation mode
     *
     * FUTURE: When ESP32 is connected, remove this method and handle data via POST endpoints
     */
    startDataSimulation() {
        // Preparation mode: no data simulation
        // Real data will come from:
        // 1. HTTP POST /api/v1/water/readings (from ESP32)
        // 2. MQTT broker (optional)
        // 3. Direct database polling
        const baseUrl = `http://${config_1.config.server.host}:${config_1.config.server.port}`;
        logger_1.logger.info('✓ Backend in preparation mode - ready to receive ESP32 sensor data via API');
        logger_1.logger.info(`✓ ESP32 should POST to: ${baseUrl}/api/v1/water/readings`);
        logger_1.logger.info('✓ Request format: { temperature, ph, do, turbidity, location, timestamp }');
    }
}
exports.WaterQualityWebSocketServer = WaterQualityWebSocketServer;
//# sourceMappingURL=waterQualityWS.js.map