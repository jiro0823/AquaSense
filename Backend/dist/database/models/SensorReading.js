"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSensorReadingModel = exports.SensorReading = void 0;
const sequelize_1 = require("sequelize");
const connection_1 = require("../connection");
/**
 * SensorReading model for storing water quality measurements
 */
class SensorReading extends sequelize_1.Model {
}
exports.SensorReading = SensorReading;
/**
 * Initialize SensorReading model
 */
const initializeSensorReadingModel = () => {
    const sequelize = (0, connection_1.getDatabase)();
    SensorReading.init({
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
        },
        temperature: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
            validate: {
                min: -200,
                max: 150,
            },
        },
        ph: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
            validate: {
                min: 0,
                max: 50,
            },
        },
        do: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
            validate: {
                min: 0,
                max: 20,
            },
        },
        turbidity: {
            type: sequelize_1.DataTypes.FLOAT,
            allowNull: false,
            validate: {
                min: 0,
                max: 5000,
            },
        },
        location: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            defaultValue: 'Default Location',
        },
        timestamp: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: sequelize_1.DataTypes.NOW,
        },
    }, {
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
    });
};
exports.initializeSensorReadingModel = initializeSensorReadingModel;
//# sourceMappingURL=SensorReading.js.map