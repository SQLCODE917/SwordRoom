import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@starter/shared/rules/characterCreation': fileURLToPath(
        new URL('../shared/src/rules/characterCreation.ts', import.meta.url)
      ),
      '@starter/shared/rules/equipmentRoster': fileURLToPath(
        new URL('../shared/src/rules/equipmentRoster.ts', import.meta.url)
      ),
    },
  },
});
