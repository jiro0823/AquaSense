/**
 * Water Quality WebSocket Handler
 * Real-time data broadcasting using Socket.io
 */
import { Server as SocketIOServer } from 'socket.io';
export declare class WaterQualityWebSocketHandler {
    private io;
    private connectedClients;
    constructor(io: SocketIOServer);
    /**
     * Setup all WebSocket event handlers
     */
    private setupEventHandlers;
    /**
     * Broadcast new reading to all connected clients
     */
    broadcastReading(reading: any): void;
    /**
     * Broadcast alert to all connected clients
     */
    broadcastAlert(alert: any): void;
    /**
     * Broadcast statistics update
     */
    broadcastStats(stats: any): void;
    /**
     * Get connected clients count
     */
    getConnectedClientsCount(): number;
    /**
     * Simulate real-time data from IoT device (for testing/demo)
     * Remove or modify this in production when connecting real ESP32
     */
    private startDataSimulation;
}
/**
 * Initialize WebSocket for water quality monitoring
 */
export declare function initializeWaterQualityWebSocket(io: SocketIOServer): WaterQualityWebSocketHandler;
//# sourceMappingURL=waterWebSocket.d.ts.map