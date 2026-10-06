import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Run `pnpm env:init` to create .env.");
  }
  return drizzle(postgres(url, { max: 10 }), { schema });
}

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

export function getDb() {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
