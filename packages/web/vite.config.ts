import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@starter/shared/contracts/db',
        replacement: fileURLToPath(new URL('../shared/src/contracts/db.ts', import.meta.url)),
      },
      {
        find: '@starter/shared/rules/equipmentRoster',
        replacement: fileURLToPath(new URL('../shared/src/rules/equipmentRoster.ts', import.meta.url)),
      },
      {
        find: '@starter/engine',
        replacement: fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)),
      },
      {
        find: '@starter/shared',
        replacement: fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      },
    ],
  },
  server: {
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  }
});
