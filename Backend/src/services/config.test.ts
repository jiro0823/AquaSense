import test from 'node:test';
import assert from 'node:assert/strict';
import { config, validateConfiguration } from '../config/config';

test('configuration requires a strong JWT secret', () => {
  const missing = validateConfiguration({ ...config, jwt: { ...config.jwt, secret: '' } }, 'development');
  assert.ok(missing.some((issue) => issue.includes('JWT_SECRET')));

  const short = validateConfiguration({ ...config, jwt: { ...config.jwt, secret: 'too-short' } }, 'development');
  assert.ok(short.some((issue) => issue.includes('32 characters')));

  const valid = validateConfiguration({ ...config, jwt: { ...config.jwt, secret: 'a'.repeat(48) } }, 'development');
  assert.equal(valid.some((issue) => issue.includes('JWT_SECRET')), false);
});

test('UniSMS credentials are optional and missing values do not invalidate core configuration', () => {
  const issues = validateConfiguration({
    ...config,
    jwt: { ...config.jwt, secret: 'a'.repeat(48) },
    sms: { ...config.sms, apiSecretKey: undefined, senderId: undefined },
  }, 'development');
  assert.equal(issues.some((issue) => issue.includes('UNISMS_API_SECRET_KEY')), false);
});

test('database credentials cannot remain template placeholders', () => {
  const issues = validateConfiguration({
    ...config,
    jwt: { ...config.jwt, secret: 'a'.repeat(48) },
    database: { ...config.database, password: '<your-local-database-password>' },
  }, 'development');
  assert.ok(issues.some((issue) => issue.includes('DB_PASSWORD')));
});

test('production authentication configuration remains strict without exposing secret values', () => {
  const secret = 'super-secret-value-that-must-not-be-reported';
  const issues = validateConfiguration({
    ...config,
    jwt: { ...config.jwt, secret },
    device: { ...config.device, keys: {} },
  }, 'production');
  assert.ok(issues.some((issue) => issue.includes('DEVICE_KEYS')));
  assert.equal(issues.some((issue) => issue.includes(secret)), false);
});

test('production MQTT requires TLS, paired broker credentials, and device-scoped topics', () => {
  const common = {
    ...config,
    jwt: { ...config.jwt, secret: 'a'.repeat(48) },
    device: { ...config.device, keys: { board: 'device-key-value' } },
    authCookie: { ...config.authCookie, secure: true, sameSite: 'none' as const },
    cors: { ...config.cors, origin: ['https://aquasense.example'] },
  };
  const valid = validateConfiguration({
    ...common,
    mqtt: { ...config.mqtt, brokerUrl: 'mqtts://broker.example:8883', username: 'device-service', password: 'broker-secret', deviceScopedTopics: true, actuatorCommandsEnabled: true },
  }, 'production');
  assert.equal(valid.some(issue => issue.startsWith('MQTT_')), false);

  const insecure = validateConfiguration({
    ...common,
    mqtt: { ...config.mqtt, brokerUrl: 'mqtt://broker.example:1883', username: undefined, password: undefined, deviceScopedTopics: false },
  }, 'production');
  assert.ok(insecure.some(issue => issue.includes('mqtts:// or wss://')));
  assert.ok(insecure.some(issue => issue.includes('MQTT_USERNAME and MQTT_PASSWORD')));
  assert.ok(insecure.some(issue => issue.includes('MQTT_DEVICE_SCOPED_TOPICS')));
});

test('MQTT broker credentials cannot be embedded in the URL', () => {
  const issues = validateConfiguration({
    ...config,
    mqtt: { ...config.mqtt, brokerUrl: 'mqtts://user:secret@broker.example:8883' },
  }, 'development');
  assert.ok(issues.some(issue => issue.includes('not URL userinfo')));
  assert.equal(issues.some(issue => issue.includes('secret')), false);
});

test('actuator commands cannot be enabled on anonymous or unscoped MQTT', () => {
  const issues = validateConfiguration({
    ...config,
    mqtt: { ...config.mqtt, brokerUrl: 'mqtt://broker.hivemq.com:1883', username: undefined, password: undefined,
      deviceScopedTopics: true, actuatorCommandsEnabled: true },
  }, 'development');
  assert.ok(issues.some((issue) => issue.includes('MQTT actuator commands require TLS, broker credentials, and device-scoped topics')));
});
