import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { assertTestDatabaseUrl, withDatabaseName } from "./test-database-url.mts";

/** The owner of the data that is already in a test database when the migrations run. */
export const TEST_OWNER_EMAIL = "owner@example.test";

/**
 * Applies the migrations in `migrationsFolder` to the database behind `url`, the way
 * scripts/migrate.ts does: the email of the owner of the existing data goes to the migration
 * through the setting `app.owner_email`. Without `ownerEmail` the setting is not set.
 */
export async function applyMigrations(
  url: string,
  {
    migrationsFolder = "./drizzle",
    ownerEmail,
  }: { migrationsFolder?: string; ownerEmail?: string },
) {
  assertTestDatabaseUrl(url);
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    if (ownerEmail !== undefined)
      await client`select set_config('app.owner_email', ${ownerEmail}, false)`;
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

/** Creates the database behind `url` if it is missing. */
export async function createDatabaseIfMissing(url: string) {
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
}

/** Drops the test database behind `url` (if there is one) and creates it again, empty. */
export async function recreateDatabase(url: string) {
  assertTestDatabaseUrl(url);
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  const admin = postgres(withDatabaseName(url, "postgres"), { max: 1, onnotice: () => {} });
  try {
    await admin`drop database if exists ${admin(name)} with (force)`;
  } finally {
    await admin.end();
  }
  await createDatabaseIfMissing(url);
}

/** Creates the database behind `url` if it is missing and applies the migrations in ./drizzle. */
export async function prepareTestDatabase(url: string) {
  await createDatabaseIfMissing(url);
  await applyMigrations(url, { ownerEmail: TEST_OWNER_EMAIL });
}
