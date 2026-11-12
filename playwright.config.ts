import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Smoke tests run against the production build (pnpm build first).
  webServer: {
    command: `pnpm start --port ${port}`,
    url: `http://localhost:${port}/tools/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
