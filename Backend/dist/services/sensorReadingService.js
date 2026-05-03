"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sensorReadingService = void 0;
/**
 * Sensor Reading Service - Handles sensor data management
 * Stores and retrieves water quality sensor readings from PostgreSQL database
 */
const logger_1 = require("../utils/logger");
const SensorReading_1 = require("../database/models/SensorReading");
const sequelize_1 = require("sequelize");
class SensorReadingService {
    /**
     * Add a new sensor reading
     */
    async addSensorReading(temperature, ph, do_value, turbidity, location = 'Default Location', timestamp = new Date()) {
        try {
            const reading = await SensorReading_1.SensorReading.create({
                temperature,
                ph,
                do: do_value,
                turbidity,
                location,
                timestamp,
            });
            logger_1.logger.info('Sensor reading stored', { id: reading.id, location });
            return this.mapSensorModel(reading);
        }
        catch (error) {
            logger_1.logger.error('Error adding sensor reading', error);
            throw error;
        }
    }
    /**
     * Get latest sensor reading
     */
    async getLatestReading() {
        try {
            const reading = await SensorReading_1.SensorReading.findOne({
                order: [['timestamp', 'DESC']],
            });
            return reading ? this.mapSensorModel(reading) : null;
        }
        catch (error) {
            logger_1.logger.error('Error fetching latest reading', error);
            return null;
        }
    }
    /**
     * Get sensor readings within time range (in minutes)
     */
    async getReadingsByTimeRange(minutes = 60) {
        try {
            const timeSinceMinutes = new Date(Date.now() - minutes * 60 * 1000);
            const readings = await SensorReading_1.SensorReading.findAll({
                where: {
                    timestamp: {
                        [sequelize_1.Op.gte]: timeSinceMinutes,
                    },
                },
                order: [['timestamp', 'DESC']],
            });
            return readings.map((r) => this.mapSensorModel(r));
        }
        catch (error) {
            logger_1.logger.error('Error fetching readings by time range', error);
            return [];
        }
    }
    /**
     * Get statistics for a parameter within time range
     */
    async getStatistics(minutes = 60) {
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
            const calculateStats = (dataArray) => {
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
        }
        catch (error) {
            logger_1.logger.error('Error calculating statistics', error);
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
    async getAllReadings(location, limit = 100) {
        try {
            const where = location ? { location } : {};
            const readings = await SensorReading_1.SensorReading.findAll({
                where,
                order: [['timestamp', 'DESC']],
                limit,
            });
            return readings.map((r) => this.mapSensorModel(r));
        }
        catch (error) {
            logger_1.logger.error('Error fetching all readings', error);
            return [];
        }
    }
    /**
     * Delete old readings (older than specified minutes)
     */
    async deleteOldReadings(minutes = 10080) {
        try {
            const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
            const deletedCount = await SensorReading_1.SensorReading.destroy({
                where: {
                    timestamp: {
                        [sequelize_1.Op.lt]: timeThreshold,
                    },
                },
            });
            logger_1.logger.info('Old sensor readings deleted', { count: deletedCount, minutesOld: minutes });
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error('Error deleting old readings', error);
            throw error;
        }
    }
    /**
     * Map Sequelize SensorReading model to SensorReading interface
     */
    mapSensorModel(reading) {
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
exports.sensorReadingService = new SensorReadingService();
//# sourceMappingURL=sensorReadingService.js.map