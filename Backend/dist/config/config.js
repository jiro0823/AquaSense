"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const envPath = path_1.default.resolve(__dirname, '..', '..', '.env');
const fileEnv = dotenv_1.default.config({ path: envPath, override: true }).parsed || {};
const getEnv = (key, fallback) => {
    if (fileEnv[key] !== undefined) {
        return fileEnv[key];
    }
    if (process.env[key] !== undefined) {
        return process.env[key];
    }
    return fallback;
};
/**
 * Application configuration
 */
exports.config = {
    server: {
        nodeEnv: getEnv('NODE_ENV', 'development') || 'development',
        port: parseInt(getEnv('PORT', '5000') || '5000', 10),
        host: getEnv('HOST', 'localhost') || 'localhost',
    },
    api: {
        version: getEnv('API_VERSION', 'v1') || 'v1',
    },
    logging: {
        level: getEnv('LOG_LEVEL', 'info') || 'info',
    },
    cors: {
        origin: getEnv('CORS_ORIGIN')?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    },
    database: {
        host: getEnv('DB_HOST', 'localhost') || 'localhost',
        port: parseInt(getEnv('DB_PORT', '5432') || '5432', 10),
        name: getEnv('DB_NAME', 'AquaSense') || 'AquaSense',
        user: getEnv('DB_USER', 'postgres') || 'postgres',
        password: getEnv('DB_PASSWORD', 'postgres') || 'postgres',
        dialect: getEnv('DB_DIALECT', 'postgres') || 'postgres',
    },
    jwt: {
        secret: getEnv('JWT_SECRET', 'your_jwt_secret_key_change_in_production') || 'your_jwt_secret_key_change_in_production',
        expiry: getEnv('JWT_EXPIRY', '24h') || '24h',
    },
};
//# sourceMappingURL=config.js.map