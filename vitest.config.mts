import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { getTestDatabaseUrl } from "./tests/test-database-url.mts";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path("./src")}/` },
      // Next.js resolves "server-only" to this empty file on the server; here it would throw.
      { find: /^server-only$/, replacement: path("./node_modules/server-only/empty.js") },
      // The real connection() throws outside a Next.js request (see tests/shims/next-server.ts).
      { find: /^next\/server$/, replacement: path("./tests/shims/next-server.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // One shared database that the tests clear: files must not run at the same time.
    fileParallelism: false,
    env: { DATABASE_URL: getTestDatabaseUrl() },
  },
});
