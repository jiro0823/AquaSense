/**
 * MQTT Service
 * Connects to MQTT broker and subscribes to ESP32 sensor data
 * Processes incoming messages and feeds them to waterQualityService
 */
import type { WaterQualityReading, WaterQualityStats } from '../iot/water/types';
interface MQTTConfig {
    brokerUrl: string;
    username?: string;
    password?: string;
    clientId?: string;
    defaultDo: number;
    topics: {
        readings: string;
        sensorWildcard: string;
        commands: string;
        status: string;
    };
}
export declare class MQTTService {
    private client;
    private config;
    private isConnected;
    private reconnectInterval;
    private latestSensorPayload;
    private pendingBatchFlags;
    private onReadingReceived?;
    private onStatsUpdated?;
    constructor(config?: Partial<MQTTConfig>);
    /**
     * Connect to MQTT broker and start listening
     */
    connect(): Promise<void>;
    /**
     * Subscribe to topics
     */
    private subscribe;
    /**
     * Handle incoming MQTT messages
     */
    private handleMessage;
    /**
     * Process sensor reading from ESP32
     * Expected format: {temperature, ph, do, turbidity, location?, timestamp?}
     */
    private handleSensorReading;
    setRealtimeHandlers(handlers: {
        onReadingReceived?: (reading: WaterQualityReading) => void;
        onStatsUpdated?: (stats: WaterQualityStats) => void;
    }): void;
    /**
     * Handle topic-per-parameter payloads, e.g.:
     * aquasense/temperature => 26.4
     * aquasense/ph => 7.19
     * aquasense/turbidity => 324
     */
    private handleAquasenseTopicValue;
    private isAquasenseSensorTopic;
    private sanitizeSensorValues;
    /**
     * Handle remote commands
     */
    private handleCommand;
    /**
     * Publish device status
     */
    private publishStatus;
    /**
     * Disconnect from MQTT broker
     */
    disconnect(): Promise<void>;
    /**
     * Check connection status
     */
    getStatus(): {
        connected: boolean;
        brokerUrl: string;
        subscribedTopics: string[];
    };
}
export declare const mqttService: MQTTService;
export {};
//# sourceMappingURL=mqttService.d.ts.map