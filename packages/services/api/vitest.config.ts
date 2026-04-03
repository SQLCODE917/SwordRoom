import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@starter/shared/fixtures': resolve(__dirname, '../../shared/src/fixtures/index.ts'),
      '@starter/shared': resolve(__dirname, '../../shared/src/index.ts'),
      '@starter/services-shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/'],
  },
});
