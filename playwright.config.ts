import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Safe because every test already gets its own browser context by default,
  // so no login or cart state leaks between them. See README, "Parallelism".
  fullyParallel: true,

  // Playwright defaults to half the logical cores (8 here), which across three
  // browser projects launches more browsers than the machine can start: Firefox
  // began timing out in `setting up "page"` - before any test code ran. Capping
  // the workers removed every one of those failures.
  workers: 4,

  // Backstop for load flake against a shared public demo site, not the fix for
  // it (the worker cap above is) and not a way to paper over genuine flakiness:
  // TC-BUG-03 had a real race, and that was fixed at the source.
  retries: 1,

  reporter: [
    // open: 'never' - the default launches a browser after every run.
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'https://www.saucedemo.com',

    // SauceDemo marks elements with `data-test`, but getByTestId() looks for
    // `data-testid`. Without this line every getByTestId() finds nothing.
    testIdAttribute: 'data-test',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
