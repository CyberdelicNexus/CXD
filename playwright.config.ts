import { defineConfig, devices } from '@playwright/test';

// Use the test port (production build) for stable asset delivery.
// The dev server (port 3000) continuously recompiles, causing versioned
// asset URLs to 404 mid-request and preventing React from hydrating.
// The production server (port 3002) serves hash-based assets that are
// stable for the lifetime of the build.
const TEST_PORT = process.env.TEST_PORT || '3002';
const BASE_URL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // persistence tests need sequential order
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Show browser window locally; run headless in CI or when HEADLESS=1
    headless: !!process.env.CI || !!process.env.HEADLESS,
  },
  projects: [
    // Auth setup runs first
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      use: { headless: true }, // setup doesn't need to be visible
    },
    // Chrome — default for persistence + collab tests
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
        // Position Chrome on the left half of the screen
        launchOptions: {
          args: ['--window-position=0,0', '--window-size=1280,900'],
        },
      },
      dependencies: ['setup'],
    },
  ],
});
