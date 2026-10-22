import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL || 'http://localhost:5001/api/v1';
  const apiOrigin = new URL(apiUrl, 'http://localhost:5001').origin;

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
    },
    resolve: {
      alias: {
        '@': `${__dirname}/src`,
        '@components': `${__dirname}/src/components`,
        '@pages': `${__dirname}/src/pages`,
        '@hooks': `${__dirname}/src/hooks`,
        '@utils': `${__dirname}/src/utils`,
        '@types': `${__dirname}/src/types`,
        '@services': `${__dirname}/src/services`,
      },
    },
  };
});
