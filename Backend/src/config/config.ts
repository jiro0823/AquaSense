import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '..', '..', '.env');
const fileEnv = dotenv.config({ path: envPath, override: true }).parsed || {};

const getEnv = (key: string, fallback?: string): string | undefined => {
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
export const config = {
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
    dialect: (getEnv('DB_DIALECT', 'postgres') as 'postgres') || 'postgres',
  },
  jwt: {
    secret: getEnv('JWT_SECRET', '') || '',
    expiry: getEnv('JWT_EXPIRY', '24h') || '24h',
  },
};
