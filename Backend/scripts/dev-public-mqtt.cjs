const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const backendDir = path.resolve(__dirname, '..');
const baseEnvPath = path.join(backendDir, '.env');
const profilePath = path.join(backendDir, '.env.public-dev');
const allowedKeys = new Set([
  'MQTT_BROKER_URL',
  'MQTT_USERNAME',
  'MQTT_PASSWORD',
  'MQTT_CA_CERT',
  'MQTT_CA_CERT_PATH',
  'MQTT_DEVICE_SCOPED_TOPICS',
  'MQTT_TOPIC_NAMESPACE',
  'MQTT_ACTUATOR_COMMANDS_ENABLED',
  'PORT',
]);

if (!fs.existsSync(baseEnvPath)) {
  throw new Error('Backend/.env is required for the local database and application settings.');
}
if (!fs.existsSync(profilePath)) {
  throw new Error('Copy Backend/public-dev.env.example to Backend/.env.public-dev first.');
}

const base = dotenv.config({ path: baseEnvPath, override: false });
if (base.error) throw base.error;

const profile = dotenv.parse(fs.readFileSync(profilePath));
const unexpected = Object.keys(profile).filter((key) => !allowedKeys.has(key));
if (unexpected.length > 0) {
  throw new Error(`Public MQTT profile contains unsupported settings: ${unexpected.join(', ')}`);
}
if (profile.MQTT_BROKER_URL !== 'mqtt://broker.hivemq.com:1883' ||
    profile.MQTT_DEVICE_SCOPED_TOPICS !== 'true' ||
    profile.MQTT_TOPIC_NAMESPACE !== 'aquasense-dev' ||
    profile.MQTT_ACTUATOR_COMMANDS_ENABLED !== 'false' ||
    profile.MQTT_USERNAME !== '' || profile.MQTT_PASSWORD !== '') {
  throw new Error('Public MQTT profile must use anonymous HiveMQ, scoped aquasense-dev topics, and disabled actuator command publication.');
}

for (const [key, value] of Object.entries(profile)) process.env[key] = value;
// Vite may fall back from 3000 to 3001 when the default development port is occupied.
const corsOrigins = new Set((process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean));
for (const origin of ['http://localhost:3000', 'http://localhost:3001']) corsOrigins.add(origin);
process.env.CORS_ORIGIN = [...corsOrigins].join(',');
if (process.argv.includes('--check')) {
  console.log('Public MQTT development profile is valid: anonymous HiveMQ, aquasense-dev scoped topics, actuator command publication disabled, localhost Vite origins 3000/3001 allowed.');
  process.exit(0);
}

async function start() {
  const host = process.env.HOST || 'localhost';
  const port = Number(process.env.PORT || '5001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const { checkStartup } = require('./dev.cjs');
  if (await checkStartup(host, port) === 'running') {
    console.log(`AquaSense backend is already healthy on port ${port}. No second instance was started; verify its MQTT profile in the original terminal.`);
    return;
  }

  console.log('Starting AquaSense with the isolated public MQTT development profile; actuator command publication is disabled.');
  require('ts-node/register');
  require('../src/server');
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
