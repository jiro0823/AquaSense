import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
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
});
