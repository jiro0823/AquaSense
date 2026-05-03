"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.syncDatabase = exports.getDatabase = exports.initializeDatabase = void 0;
const sequelize_1 = require("sequelize");
const logger_1 = require("../utils/logger");
/**
 * Sequelize database instance
 */
let sequelize;
/**
 * Initialize database connection
 */
const initializeDatabase = async () => {
    try {
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
        const dbName = process.env.DB_NAME || 'AquaSense';
        const dbUser = process.env.DB_USER || 'postgres';
        const dbPassword = process.env.DB_PASSWORD || 'postgres';
        const dbDialect = process.env.DB_DIALECT || 'postgres';
        sequelize = new sequelize_1.Sequelize(dbName, dbUser, dbPassword, {
            host: dbHost,
            port: dbPort,
            dialect: dbDialect,
            logging: (msg) => logger_1.logger.debug(msg),
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000,
            },
            define: {
                timestamps: true,
                underscored: true,
            },
        });
        // Test connection
        await sequelize.authenticate();
        logger_1.logger.info(`✓ Database connected: ${dbName} on ${dbHost}:${dbPort}`);
        // Don't sync yet - models need to be initialized first
        return sequelize;
    }
    catch (error) {
        logger_1.logger.error(`✗ Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
/**
 * Get database instance
 */
const getDatabase = () => {
    if (!sequelize) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return sequelize;
};
exports.getDatabase = getDatabase;
/**
 * Sync database models (create tables if they don't exist)
 */
const syncDatabase = async () => {
    if (!sequelize) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    await sequelize.sync({ alter: false });
    logger_1.logger.info('✓ Database models synchronized');
};
exports.syncDatabase = syncDatabase;
/**
 * Close database connection
 */
const closeDatabase = async () => {
    if (sequelize) {
        await sequelize.close();
        logger_1.logger.info('✓ Database connection closed');
    }
};
exports.closeDatabase = closeDatabase;
//# sourceMappingURL=connection.js.map