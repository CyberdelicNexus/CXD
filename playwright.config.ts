import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // persistence tests need sequential order
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
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
