/**
 * Water Quality Monitoring - Type Definitions
 */
export interface WaterQualityData {
    id: string;
    deviceId: string;
    temperature: number;
    pH: number;
    dissolvedOxygen: number;
    turbidity: number;
    timestamp: Date;
    location?: string;
    status: 'good' | 'warning' | 'critical' | 'offline';
}
export interface WaterQualityThresholds {
    temperature: {
        min: number;
        max: number;
        critical: {
            min: number;
            max: number;
        };
    };
    pH: {
        min: number;
        max: number;
        critical: {
            min: number;
            max: number;
        };
    };
    dissolvedOxygen: {
        min: number;
        max: number;
        critical: number;
    };
    turbidity: {
        max: number;
        critical: number;
    };
}
export interface DeviceInfo {
    id: string;
    name: string;
    location: string;
    latitude?: number;
    longitude?: number;
    isActive: boolean;
    lastSeen: Date;
}
export interface WaterQualityAlert {
    id: string;
    deviceId: string;
    type: 'temperature' | 'pH' | 'dissolvedOxygen' | 'turbidity';
    severity: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
    timestamp: Date;
    resolved: boolean;
}
export interface WaterQualityStats {
    deviceId: string;
    period: 'hour' | 'day' | 'week' | 'month';
    averageTemperature: number;
    averagePH: number;
    averageDissolvedOxygen: number;
    averageTurbidity: number;
    minTemperature: number;
    maxTemperature: number;
    criticalAlerts: number;
    warningAlerts: number;
}
/**
 * Status determination based on parameters
 */
export declare enum WaterQualityStatus {
    GOOD = "good",
    WARNING = "warning",
    CRITICAL = "critical",
    OFFLINE = "offline"
}
/**
 * Default thresholds for water quality (can be customized per device)
 */
export declare const DEFAULT_THRESHOLDS: WaterQualityThresholds;
//# sourceMappingURL=waterQuality.d.ts.map