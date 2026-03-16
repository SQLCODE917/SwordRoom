import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules/', 'dist/'],
  },
});
