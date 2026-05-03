"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaterQualityWebSocketHandler = void 0;
exports.initializeWaterQualityWebSocket = initializeWaterQualityWebSocket;
const logger_1 = require("../../../utils/logger");
const waterQualityService_1 = require("../services/waterQualityService");
class WaterQualityWebSocketHandler {
    constructor(io) {
        this.connectedClients = new Set();
        this.io = io;
        this.setupEventHandlers();
        this.startDataSimulation();
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
            // Send latest reading on connection
            const latest = waterQualityService_1.waterQualityService.getLatestReading();
            if (latest) {
                socket.emit('water:latest', latest);
            }
            // Send current statistics
            try {
                const stats = waterQualityService_1.waterQualityService.getStatistics(60);
                socket.emit('water:stats', stats);
            }
            catch {
                logger_1.logger.debug('No stats available yet');
            }
            // Handle client events
            socket.on('water:request-latest', () => {
                const latest = waterQualityService_1.waterQualityService.getLatestReading();
                socket.emit('water:latest', latest);
            });
            socket.on('water:request-stats', (minutes) => {
                try {
                    const stats = waterQualityService_1.waterQualityService.getStatistics(minutes || 60);
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
            socket.on('disconnect', () => {
                this.connectedClients.delete(socket.id);
                logger_1.logger.info(`Water quality client disconnected: ${socket.id}`, {
                    totalClients: this.connectedClients.size,
                });
            });
        });
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
     * Simulate real-time data from IoT device (for testing/demo)
     * Remove or modify this in production when connecting real ESP32
     */
    startDataSimulation() {
        setInterval(() => {
            // Generate realistic water quality data with slight variations
            const baseData = {
                temperature: 25 + (Math.random() - 0.5) * 4,
                ph: 7.5 + (Math.random() - 0.5) * 0.5,
                do: 7.5 + (Math.random() - 0.5) * 2,
                turbidity: 30 + (Math.random() - 0.5) * 20,
                location: 'Main Water Body',
                timestamp: new Date(),
            };
            const reading = waterQualityService_1.waterQualityService.addReading(baseData);
            this.broadcastReading(reading);
            // Update statistics every 5 readings
            if (Math.random() < 0.2) {
                try {
                    const stats = waterQualityService_1.waterQualityService.getStatistics(60);
                    this.broadcastStats(stats);
                }
                catch {
                    logger_1.logger.debug('Stats calculation not available');
                }
            }
        }, 5000); // Simulate data every 5 seconds
    }
}
exports.WaterQualityWebSocketHandler = WaterQualityWebSocketHandler;
/**
 * Initialize WebSocket for water quality monitoring
 */
function initializeWaterQualityWebSocket(io) {
    return new WaterQualityWebSocketHandler(io);
}
//# sourceMappingURL=waterWebSocket.js.map