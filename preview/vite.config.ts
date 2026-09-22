import {resolve} from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig({
  root: resolve(__dirname),
  server: {host: '127.0.0.1', port: 4173, strictPort: true},
  build: {
    outDir: resolve(__dirname, '../build/device-preview'),
    emptyOutDir: true,
  },
});
