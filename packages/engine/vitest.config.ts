import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@starter/shared/fixtures',
        replacement: fileURLToPath(new URL('../shared/src/fixtures/index.ts', import.meta.url)),
      },
      {
        find: '@starter/shared/rules/characterCreation',
        replacement: fileURLToPath(new URL('../shared/src/rules/characterCreation.ts', import.meta.url)),
      },
      {
        find: '@starter/shared/rules/equipmentRoster',
        replacement: fileURLToPath(new URL('../shared/src/rules/equipmentRoster.ts', import.meta.url)),
      },
      {
        find: '@starter/shared',
        replacement: fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      },
    ],
  },
});
