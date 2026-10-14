import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { getTestDatabaseUrl } from "./tests/test-database-url.mts";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Who is logged in is told by the test itself (see tests/shims/current-user.ts).
      { find: /^@\/lib\/current-user$/, replacement: path("./tests/shims/current-user.ts") },
      // Must stay above the "@/" rule below: the first rule that fits wins.
      { find: /^@\//, replacement: `${path("./src")}/` },
      // Next.js resolves "server-only" to this empty file on the server; here it would throw.
      { find: /^server-only$/, replacement: path("./node_modules/server-only/empty.js") },
      // The real connection() throws outside a Next.js request (see tests/shims/next-server.ts).
      { find: /^next\/server$/, replacement: path("./tests/shims/next-server.ts") },
      // Same for revalidatePath(): there is no page to refresh.
      { find: /^next\/cache$/, replacement: path("./tests/shims/next-cache.ts") },
      // Same for headers(): there is no request to read them from.
      { find: /^next\/headers$/, replacement: path("./tests/shims/next-headers.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // One shared database that the tests clear: files must not run at the same time.
    fileParallelism: false,
    env: {
      DATABASE_URL: getTestDatabaseUrl(),
      // Login settings for the tests: made-up values, nothing here is a real secret.
      BETTER_AUTH_SECRET: "test-only-secret-0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: "http://localhost:3000",
      // A closed port: the mail service is "down" for real. Tests that need it up say so.
      SMTP_URL: "smtp://127.0.0.1:1",
      MAIL_FROM: "Личная CRM <noreply@mail.crm.vprodcrm.ru>",
    },
  },
});
