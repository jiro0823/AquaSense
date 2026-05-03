import { Model } from 'sequelize';
/**
 * SensorReading model for storing water quality measurements
 */
export declare class SensorReading extends Model {
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
/**
 * Initialize SensorReading model
 */
export declare const initializeSensorReadingModel: () => void;
//# sourceMappingURL=SensorReading.d.ts.map