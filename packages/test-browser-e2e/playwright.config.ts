import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, '../..');
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
const workerCount = process.env.PLAYWRIGHT_WORKERS
  ? Number(process.env.PLAYWRIGHT_WORKERS)
  : process.env.CI
    ? 2
    : Math.min(4, os.availableParallelism());

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: Number.isFinite(workerCount) && workerCount > 0 ? workerCount : 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: `RUN_AUTH_MODE=dev RUN_DEV_ACTOR_ID=player-aaa bash "${path.join(repoRoot, 'scripts/local/dev-up.sh')}"`,
    cwd: repoRoot,
    url: `${baseURL}/api/me`,
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
