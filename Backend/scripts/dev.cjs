const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const backendDir = path.resolve(__dirname, '..');

function readJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 16384) request.destroy(new Error('Unexpected health response'));
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error('Health check failed');
          resolve(JSON.parse(body));
        } catch (error) { reject(error); }
      });
    });
    request.setTimeout(2000, () => request.destroy(new Error('Health check timed out')));
    request.on('error', reject);
  });
}

async function checkStartup(host, port) {
  const available = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') resolve(false);
      else reject(error);
    });
    probe.listen(port, host, () => probe.close(() => resolve(true)));
  });
  if (available) return 'available';

  const checkHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '[::1]' : host.includes(':') ? `[${host}]` : host;
  const baseUrl = `http://${checkHost}:${port}`;
  try {
    const [health, root] = await Promise.all([readJson(`${baseUrl}/health`), readJson(baseUrl)]);
    if (health.success === true && health.message === 'Server is healthy' &&
        root.message === 'Welcome to Capstone Backend API - Water Quality IoT System') {
      return 'running';
    }
  } catch {
    // An occupied port alone does not prove that AquaSense is healthy.
  }
  throw new Error(`Port ${port} is occupied, but a healthy AquaSense backend could not be verified. Check the terminal for the existing process before restarting it.`);
}

async function main() {
  const envPath = path.join(backendDir, '.env');
  const fileEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
  const host = fileEnv.HOST ?? process.env.HOST ?? 'localhost';
  const port = Number(fileEnv.PORT ?? process.env.PORT ?? '5001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535 in Backend/.env');

  if (await checkStartup(host || 'localhost', port) === 'running') {
    console.log(`AquaSense backend is already running and healthy on port ${port}. No second instance was started.`);
    console.log('Use the existing backend terminal. To restart it, stop that instance with Ctrl+C before running npm run dev again.');
    return;
  }

  const child = spawn(process.execPath, [require.resolve('nodemon/bin/nodemon.js'), '--exec', 'ts-node', 'src/server.ts', ...process.argv.slice(2)], {
    cwd: backendDir,
    stdio: 'inherit',
  });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1); });
}

module.exports = { checkStartup };
if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
