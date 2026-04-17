/**
 * Sensor Reading Service - Handles sensor data management
 * Stores and retrieves water quality sensor readings from PostgreSQL database
 */
import { logger } from '../utils/logger';
import { SensorReading as SensorReadingModel } from '../database/models/SensorReading';
import { Op } from 'sequelize';

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

class SensorReadingService {
  /**
   * Add a new sensor reading
   */
  async addSensorReading(
    temperature: number,
    ph: number,
    do_value: number,
    turbidity: number,
    location: string = 'Default Location',
    timestamp: Date = new Date()
  ): Promise<SensorReading | null> {
    try {
      const reading = await SensorReadingModel.create({
        temperature,
        ph,
        do: do_value,
        turbidity,
        location,
        timestamp,
      });

      logger.info('Sensor reading stored', { id: reading.id, location });
      return this.mapSensorModel(reading);
    } catch (error) {
      logger.error('Error adding sensor reading', error);
      throw error;
    }
  }

  /**
   * Get latest sensor reading
   */
  async getLatestReading(): Promise<SensorReading | null> {
    try {
      const reading = await SensorReadingModel.findOne({
        order: [['timestamp', 'DESC']],
      });
      return reading ? this.mapSensorModel(reading) : null;
    } catch (error) {
      logger.error('Error fetching latest reading', error);
      return null;
    }
  }

  /**
   * Get sensor readings within time range (in minutes)
   */
  async getReadingsByTimeRange(minutes: number = 60): Promise<SensorReading[]> {
    try {
      const timeSinceMinutes = new Date(Date.now() - minutes * 60 * 1000);

      const readings = await SensorReadingModel.findAll({
        where: {
          timestamp: {
            [Op.gte]: timeSinceMinutes,
          },
        },
        order: [['timestamp', 'DESC']],
      });

      return readings.map((r) => this.mapSensorModel(r));
    } catch (error) {
      logger.error('Error fetching readings by time range', error);
      return [];
    }
  }

  /**
   * Get statistics for a parameter within time range
   */
  async getStatistics(minutes: number = 60): Promise<{
    temperature: SensorStatistics;
    ph: SensorStatistics;
    do: SensorStatistics;
    turbidity: SensorStatistics;
  }> {
    try {
      const readings = await this.getReadingsByTimeRange(minutes);

      if (readings.length === 0) {
        return {
          temperature: { parameter: 'Temperature', current: 0, average: 0, min: 0, max: 0 },
          ph: { parameter: 'pH', current: 0, average: 0, min: 0, max: 0 },
          do: { parameter: 'Dissolved Oxygen', current: 0, average: 0, min: 0, max: 0 },
          turbidity: { parameter: 'Turbidity', current: 0, average: 0, min: 0, max: 0 },
        };
      }

      const latestReading = readings[0];

      const calculateStats = (dataArray: number[]): { average: number; min: number; max: number } => {
        const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        const min = Math.min(...dataArray);
        const max = Math.max(...dataArray);
        return { average, min, max };
      };

      const temps = readings.map((r) => r.temperature);
      const phs = readings.map((r) => r.ph);
      const dos = readings.map((r) => r.do);
      const turbidities = readings.map((r) => r.turbidity);

      return {
        temperature: {
          parameter: 'Temperature',
          current: latestReading.temperature,
          ...calculateStats(temps),
        },
        ph: {
          parameter: 'pH',
          current: latestReading.ph,
          ...calculateStats(phs),
        },
        do: {
          parameter: 'Dissolved Oxygen',
          current: latestReading.do,
          ...calculateStats(dos),
        },
        turbidity: {
          parameter: 'Turbidity',
          current: latestReading.turbidity,
          ...calculateStats(turbidities),
        },
      };
    } catch (error) {
      logger.error('Error calculating statistics', error);
      return {
        temperature: { parameter: 'Temperature', current: 0, average: 0, min: 0, max: 0 },
        ph: { parameter: 'pH', current: 0, average: 0, min: 0, max: 0 },
        do: { parameter: 'Dissolved Oxygen', current: 0, average: 0, min: 0, max: 0 },
        turbidity: { parameter: 'Turbidity', current: 0, average: 0, min: 0, max: 0 },
      };
    }
  }

  /**
   * Get all readings with optional location filter
   */
  async getAllReadings(location?: string, limit: number = 100): Promise<SensorReading[]> {
    try {
      const where = location ? { location } : {};

      const readings = await SensorReadingModel.findAll({
        where,
        order: [['timestamp', 'DESC']],
        limit,
      });

      return readings.map((r) => this.mapSensorModel(r));
    } catch (error) {
      logger.error('Error fetching all readings', error);
      return [];
    }
  }

  /**
   * Delete old readings (older than specified minutes)
   */
  async deleteOldReadings(minutes: number = 10080): Promise<number> {
    try {
      const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);

      const deletedCount = await SensorReadingModel.destroy({
        where: {
          timestamp: {
            [Op.lt]: timeThreshold,
          },
        },
      });

      logger.info('Old sensor readings deleted', { count: deletedCount, minutesOld: minutes });
      return deletedCount;
    } catch (error) {
      logger.error('Error deleting old readings', error);
      throw error;
    }
  }

  /**
   * Map Sequelize SensorReading model to SensorReading interface
   */
  private mapSensorModel(reading: SensorReadingModel): SensorReading {
    return {
      id: reading.id,
      temperature: reading.temperature,
      ph: reading.ph,
      do: reading.do,
      turbidity: reading.turbidity,
      location: reading.location,
      timestamp: reading.timestamp,
      createdAt: reading.createdAt,
      updatedAt: reading.updatedAt,
    };
  }
}

export const sensorReadingService = new SensorReadingService();
