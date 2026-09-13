import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

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

const parseDeviceKeys = (raw?: string): Record<string, string> => {
  if (!raw) {
    return {};
  }

  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .reduce<Record<string, string>>((acc, pair) => {
      const [deviceId, key] = pair.split(':').map((part) => part.trim());
      if (deviceId && key) {
        acc[deviceId] = key;
      }
      return acc;
    }, {});
};

const nodeEnv = getEnv('NODE_ENV', 'development') || 'development';

/**
 * Application configuration
 */
export const config = {
  server: {
    nodeEnv,
    port: parseInt(getEnv('PORT', '5001') || '5001', 10),
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
    allowedHeaders: ['Content-Type', 'X-Device-Key', 'X-CSRF-Token'],
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
    secret: getEnv('JWT_SECRET') || '',
    expiry: getEnv('JWT_EXPIRY', '24h') || '24h',
  },
  authCookie: {
    name: getEnv('AUTH_COOKIE_NAME', 'aquasense_session') || 'aquasense_session',
    secure: getEnv('AUTH_COOKIE_SECURE', nodeEnv === 'production' ? 'true' : 'false') === 'true',
    sameSite: (getEnv('AUTH_COOKIE_SAMESITE', nodeEnv === 'production' ? 'none' : 'lax') || 'lax') as
      | 'lax'
      | 'strict'
      | 'none',
    maxAgeMs: parseInt(getEnv('AUTH_COOKIE_MAX_AGE_MS', '86400000') || '86400000', 10),
  },
  device: {
    keys: parseDeviceKeys(getEnv('DEVICE_KEYS')),
  },
  sms: {
    provider: 'unisms',
    apiSecretKey: getEnv('UNISMS_API_SECRET_KEY'),
    senderId: getEnv('UNISMS_SENDER_ID'),
    maxMessageLength: parseInt(getEnv('SMS_MAX_MESSAGE_LENGTH', '160') || '160', 10),
    failureThreshold: parseInt(getEnv('SMS_FAILURE_THRESHOLD', '5') || '5', 10),
    circuitCooldownMs: parseInt(getEnv('SMS_CIRCUIT_COOLDOWN_MS', '60000') || '60000', 10),
  },
  farm: {
    farmerName: getEnv('FARMER_NAME', 'Farmer') || 'Farmer',
    farmName: getEnv('FARM_NAME', 'AquaSense Farm') || 'AquaSense Farm',
    tankName: getEnv('TANK_NAME'),
    recipientPhone: getEnv('FARMER_PHONE'),
  },
};

const configSchema = z.object({
  jwt: z.object({
    secret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  }),
  authCookie: z.object({
    name: z.string().min(1, 'AUTH_COOKIE_NAME is required'),
    sameSite: z.enum(['lax', 'strict', 'none']),
    maxAgeMs: z.number().int().min(60000),
  }),
  sms: z.object({
    provider: z.literal('unisms'),
    apiSecretKey: z.string({ required_error: 'UNISMS_API_SECRET_KEY is required' }).min(1, 'UNISMS_API_SECRET_KEY is required'),
    maxMessageLength: z.number().int().min(1).max(160),
    failureThreshold: z.number().int().min(1).max(20),
    circuitCooldownMs: z.number().int().min(1000).max(3600000),
  }),
});

const validated = configSchema.safeParse(config);
if (!validated.success) {
  const issues = validated.error.issues.map((issue) => issue.message).join(', ');
  throw new Error(`Invalid application configuration: ${issues}`);
}

if (config.server.nodeEnv === 'production') {
  if (!config.jwt.secret || /change_in_production|replace-with|changeme|your_jwt_secret/i.test(config.jwt.secret)) {
    throw new Error('Invalid production configuration: JWT_SECRET must be a strong secret');
  }
  if (!config.device.keys || Object.keys(config.device.keys).length === 0) {
    throw new Error('Invalid production configuration: DEVICE_KEYS must include registered ESP32 device keys');
  }
  if (config.cors.origin.some((origin) => origin.includes('localhost'))) {
    throw new Error('Invalid production configuration: CORS_ORIGIN must not use localhost');
  }
}
