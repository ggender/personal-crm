import { defineConfig, devices } from "@playwright/test";

import { getE2eDatabaseUrl } from "./tests/test-database-url.mts";

// Not 3000: the tests start their own server on their own database and never reuse `pnpm dev`.
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;
const databaseUrl = getE2eDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  // One shared database that the tests clear: tests must not run at the same time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Database first, then the production build, as on the server.
    command: `pnpm exec tsx e2e/prepare-database.mts && pnpm build && pnpm start -p ${PORT}`,
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: databaseUrl,
      E2E_DATABASE_URL: databaseUrl,
      // A separate build folder, so a running `pnpm dev` is not disturbed.
      NEXT_DIST_DIR: ".next/e2e",
      // Login: links in the emails point to the test server; the emails go to Mailpit (the one
      // from docker-compose.yml, a service in CI), where the tests read them.
      BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: baseURL,
      SMTP_URL: "smtp://127.0.0.1:1025",
      MAIL_FROM: "Личная CRM <noreply@mail.crm.vprodcrm.ru>",
    },
  },
});
