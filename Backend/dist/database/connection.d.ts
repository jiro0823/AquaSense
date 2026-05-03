import { Sequelize } from 'sequelize';
/**
 * Initialize database connection
 */
export declare const initializeDatabase: () => Promise<Sequelize>;
/**
 * Get database instance
 */
export declare const getDatabase: () => Sequelize;
/**
 * Sync database models (create tables if they don't exist)
 */
export declare const syncDatabase: () => Promise<void>;
/**
 * Close database connection
 */
export declare const closeDatabase: () => Promise<void>;
//# sourceMappingURL=connection.d.ts.map