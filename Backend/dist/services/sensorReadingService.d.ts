export interface SensorReading {
    id: string;
    temperature: number;
    ph: number;
    do: number;
    turbidity: number;
    location: string;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface SensorStatistics {
    parameter: string;
    current: number;
    average: number;
    min: number;
    max: number;
}
declare class SensorReadingService {
    /**
     * Add a new sensor reading
     */
    addSensorReading(temperature: number, ph: number, do_value: number, turbidity: number, location?: string, timestamp?: Date): Promise<SensorReading | null>;
    /**
     * Get latest sensor reading
     */
    getLatestReading(): Promise<SensorReading | null>;
    /**
     * Get sensor readings within time range (in minutes)
     */
    getReadingsByTimeRange(minutes?: number): Promise<SensorReading[]>;
    /**
     * Get statistics for a parameter within time range
     */
    getStatistics(minutes?: number): Promise<{
        temperature: SensorStatistics;
        ph: SensorStatistics;
        do: SensorStatistics;
        turbidity: SensorStatistics;
    }>;
    /**
     * Get all readings with optional location filter
     */
    getAllReadings(location?: string, limit?: number): Promise<SensorReading[]>;
    /**
     * Delete old readings (older than specified minutes)
     */
    deleteOldReadings(minutes?: number): Promise<number>;
    /**
     * Map Sequelize SensorReading model to SensorReading interface
     */
    private mapSensorModel;
}
export declare const sensorReadingService: SensorReadingService;
export {};
//# sourceMappingURL=sensorReadingService.d.ts.map