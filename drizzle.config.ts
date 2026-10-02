import { defineConfig } from "drizzle-kit";

import { getDatabaseUrl, loadEnvFile } from "./src/db/connection-url";

loadEnvFile();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
