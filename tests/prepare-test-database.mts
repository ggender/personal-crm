import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { assertTestDatabaseUrl, withDatabaseName } from "./test-database-url.mts";

/** Creates the database behind `url` if it is missing and applies the migrations in ./drizzle. */
export async function prepareTestDatabase(url: string) {
  assertTestDatabaseUrl(url);
  const name = decodeURIComponent(new URL(url).pathname.slice(1));

  // CREATE DATABASE cannot run inside the database it creates: connect to the "postgres" one.
  const admin = postgres(withDatabaseName(url, "postgres"), { max: 1, onnotice: () => {} });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${name}`;
    if (existing.length === 0) await admin`create database ${admin(name)}`;
  } finally {
    await admin.end();
  }

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }
}
