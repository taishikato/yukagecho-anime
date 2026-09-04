import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    channel: 'chrome',
    viewport: { width: 1536, height: 1024 },
    launchOptions: { args: ['--use-angle=metal'] },
  },
  reporter: 'list',
});
