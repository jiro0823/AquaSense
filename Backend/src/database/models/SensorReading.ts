import { DataTypes, Model } from 'sequelize';
import { getDatabase } from '../connection';

/**
 * SensorReading model for storing water quality measurements
 */
export class SensorReading extends Model {
  declare id: string;
  declare temperature: number;
  declare ph: number;
  declare do: number; // Dissolved Oxygen
  declare turbidity: number;
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
      temperature: {
        type: DataTypes.FLOAT,
        allowNull: false,
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
      turbidity: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 5000,
        },
      },
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
          fields: ['location'],
        },
      ],
    }
  );
};
