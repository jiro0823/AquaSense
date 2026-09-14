import type { HealthSummary, AmmoniaSpeciation } from '../../services/sensorHealth';
import { DataTypes, Model } from 'sequelize';
import { getDatabase } from '../connection';

/**
 * SensorReading model for storing water quality measurements
 */
export class SensorReading extends Model {
  declare id: string;
  declare deviceId: string;
<<<<<<< Updated upstream
  declare temperature: number;
  declare ph: number;
  declare do: number; // Dissolved Oxygen
  declare doMeasured: boolean;
  declare turbidity: number;
  declare orp: number | null; // Millivolts; never substituted for dissolved oxygen.
  declare ammonia: number;
=======
  declare temperature: number | null;
  declare ph: number | null;
  declare do: number | null; // Dissolved Oxygen
  declare doMeasured: boolean;
  declare turbidity: number | null;
  declare orp: number | null; // Millivolts; never substituted for dissolved oxygen.
  declare ammonia: number | null;
  declare sensorHealth: HealthSummary | null;
  declare speciation: AmmoniaSpeciation | null;
  declare turbidityUnit: string;
>>>>>>> Stashed changes
  declare location: string;
  declare timestamp: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

/**
 * Initialize SensorReading model
 */
export const initializeSensorReadingModel = (): void => {
  const sequelize = getDatabase();

  SensorReading.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      deviceId: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'unknown-device',
      },
      temperature: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
      ph: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
      do: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
      doMeasured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
<<<<<<< Updated upstream
        validate: {
          min: -200,
          max: 150,
        },
      },
      ph: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 50,
        },
      },
      do: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 20,
        },
      },
      doMeasured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      turbidity: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 5000,
        },
      },
      orp: { type: DataTypes.DOUBLE, allowNull: true, defaultValue: null },
      ammonia: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 10,
        },
=======
        defaultValue: false,
>>>>>>> Stashed changes
      },
      turbidity: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
      orp: { type: DataTypes.DOUBLE, allowNull: true, defaultValue: null },
      ammonia: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
      sensorHealth: { type: DataTypes.JSONB, allowNull: true },
      speciation: { type: DataTypes.JSONB, allowNull: true },
      turbidityUnit: { type: DataTypes.STRING(16), allowNull: true },
      location: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'Default Location',
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'SensorReading',
      tableName: 'sensor_readings',
      timestamps: true,
      indexes: [
        {
          fields: ['timestamp'],
        },
        {
          fields: ['device_id'],
        },
        {
          fields: ['location'],
        },
      ],
    }
  );
};
