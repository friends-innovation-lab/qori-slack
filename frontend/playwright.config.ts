/**
 * Playwright Configuration — DR-4f Browser E2E
 *
 * Configured for desk research acceptance testing with:
 * - Chromium-only for deterministic CI execution
 * - Screenshot/trace capture on failure
 * - Isolated test environment via baseURL
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',

  // Parallel execution disabled for deterministic ordering
  fullyParallel: false,
  workers: 1,

  // Fail the build on test.only in CI
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 1 : 0,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html', { outputFolder: './e2e-report' }], ['list']]
    : [['list']],

  // Global timeout
  timeout: 30000,

  use: {
    // Base URL for tests (dev server)
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on retry
    video: 'on-first-retry',

    // Viewport for desktop tests
    viewport: { width: 1280, height: 720 },
  },

  // Projects: Desktop and narrow viewport
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  // Web server configuration (starts Vite dev server)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
