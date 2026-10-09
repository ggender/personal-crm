import postgres from "postgres";

import { assertTestDatabaseUrl, getE2eDatabaseUrl } from "../../tests/test-database-url.mts";

let client: postgres.Sql | undefined;

/** A connection to the end-to-end test database, after checking that it is a test one. */
function sql() {
  if (!client) {
    const url = getE2eDatabaseUrl();
    assertTestDatabaseUrl(url);
    client = postgres(url, { max: 1, onnotice: () => {} });
  }
  return client;
}

/** Empties every table in the public schema and restarts the id counters. */
export async function resetDb() {
  const db = sql();
  const tables = await db<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `;
  if (tables.length === 0) return;
  await db`truncate ${db(tables.map(({ tablename }) => tablename))} restart identity cascade`;
}

/** Adds contacts straight to the database, as if they had been added before. */
export async function makeContacts(names: string[]) {
  const db = sql();
  for (const name of names) await db`insert into contacts (name) values (${name})`;
}

export async function closeDb() {
  await client?.end();
  client = undefined;
}
