import type { WaterQualityReading, WaterQualityThresholds, WaterQualityStats, HealthAlert } from '../types';
export declare class WaterQualityService {
    private readings;
    private alerts;
    private thresholds;
    private readonly MAX_READINGS;
    private readonly MAX_ALERTS;
    /**
     * Add a new reading from IoT device or API
     */
    addReading(data: Omit<WaterQualityReading, 'id' | 'status'>): WaterQualityReading;
    /**
     * Get latest reading
     */
    getLatestReading(): WaterQualityReading | null;
    /**
     * Get readings within time range
     */
    getReadingsByTimeRange(minutes: number): WaterQualityReading[];
    /**
     * Get all readings (paginated)
     */
    getAllReadings(limit?: number, offset?: number): WaterQualityReading[];
    /**
     * Calculate statistics for readings
     */
    getStatistics(minutes?: number): WaterQualityStats;
    /**
     * Get recent alerts
     */
    getAlerts(limit?: number): HealthAlert[];
    /**
     * Clear old alerts
     */
    clearOldAlerts(hoursOld?: number): number;
    /**
     * Update thresholds
     */
    setThresholds(thresholds: Partial<WaterQualityThresholds>): void;
    /**
     * Get current thresholds
     */
    getThresholds(): WaterQualityThresholds;
    /**
     * Private methods
     */
    private checkThresholds;
    private createAlert;
    private evaluateStatus;
    private calculateHealthScore;
}
export declare const waterQualityService: WaterQualityService;
//# sourceMappingURL=waterQualityService.d.ts.map