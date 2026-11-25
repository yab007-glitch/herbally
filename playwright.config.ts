import { defineConfig, devices } from "@playwright/test";

/**
 * Gate-on harness switch. When `E2E_GATE_ON=1`, the suite runs against a
 * disposable copy of the repo whose `ADS_LAUNCH_GATE` constant is flipped to
 * `true` (see scripts/e2e-gate-on-server.mjs); the committed gate stays off.
 */
const GATE_ON = process.env.E2E_GATE_ON === "1";
const CUSTOM_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore:
    process.env.E2E_MIGRATED_DB === "1"
      ? undefined
      : ["**/migrated-db.spec.ts"],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL:
      CUSTOM_BASE_URL ??
      (GATE_ON ? "http://localhost:3100" : "http://localhost:3000"),

    /* Collect trace when retrying the failed test. */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers. The gate-on harness uses Chromium
   * only: two of its assertions drive the CDP Network domain directly. */
  projects: GATE_ON
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ],

  /* Run production build before starting tests for realistic results.
   * `next start` is incompatible with `output: standalone`, so we run the
   * standalone server that the build emits (then manually
   * copies .next/static + public into the standalone tree (the build does not do
   * this automatically — same as the Dockerfile). .env.local is sourced when
   * present (local dev); CI omits it. */
  webServer: CUSTOM_BASE_URL
    ? undefined
    : GATE_ON
      ? {
          command: "node scripts/e2e-gate-on-server.mjs",
          url: "http://localhost:3100",
          reuseExistingServer: !process.env.CI,
          timeout: 600_000,
          stdout: "pipe",
        }
      : {
          command:
            "npm run build && cp -r .next/static/. .next/standalone/.next/static/ && cp -r public/. .next/standalone/public/ && (set -a; [ -f .env.local ] && . .env.local; cd .next/standalone && PORT=3000 HOSTNAME=127.0.0.1 node server.js)",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
});
