import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@starter/shared/rules/characterCreation': resolve(__dirname, '../shared/src/rules/characterCreation.ts'),
      '@starter/shared/rules/equipmentRoster': resolve(__dirname, '../shared/src/rules/equipmentRoster.ts'),
      '@starter/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@starter/engine': resolve(__dirname, '../engine/src/index.ts'),
      '@starter/services-shared': resolve(__dirname, '../services/shared/src/index.ts'),
      '@starter/services-api': resolve(__dirname, '../services/api/src/index.ts'),
      '@starter/services-dispatcher': resolve(__dirname, '../services/dispatcher/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/'],
  },
});
