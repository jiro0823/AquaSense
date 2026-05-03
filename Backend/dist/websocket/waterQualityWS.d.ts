/**
 * WebSocket Server for Real-time Water Quality Monitoring
 * Using Socket.io for real-time communication
 */
import { Server as HTTPServer } from 'http';
declare class WaterQualityWebSocketServer {
    private io;
    private connectedClients;
    constructor(httpServer: HTTPServer);
    /**
     * Setup all WebSocket event handlers
     */
    private setupEventHandlers;
    private emitSnapshot;
    private getDbBackedStats;
    private calculateHealthScore;
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
     * Placeholder for data simulation
     * In production, this will receive data from ESP32 IoT device via HTTP POST to /api/v1/water/readings
     * For now, this method is a no-op to keep the system in preparation mode
     *
     * FUTURE: When ESP32 is connected, remove this method and handle data via POST endpoints
     */
    private startDataSimulation;
}
export { WaterQualityWebSocketServer };
//# sourceMappingURL=waterQualityWS.d.ts.map