const path = require('node:path');
const { spawn } = require('node:child_process');

const backendOrigin = 'http://localhost:5002';
process.env.VITE_API_URL ||= `${backendOrigin}/api/v1`;
process.env.VITE_WS_URL ||= backendOrigin;

if (process.argv.includes('--check')) {
  console.log('Public MQTT frontend profile targets the public-development backend on localhost:5002.');
  process.exit(0);
}

const viteEntry = path.resolve(path.dirname(require.resolve('vite')), '../../bin/vite.js');
const vite = spawn(process.execPath, [viteEntry, ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => vite.kill(signal));
}
vite.on('error', (error) => {
  console.error(`Unable to start Vite: ${error.message}`);
  process.exitCode = 1;
});
vite.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
});
