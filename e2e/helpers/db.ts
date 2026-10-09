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

/** Adds one contact straight to the database; returns its id. */
export async function makeContact({
  name,
  frequency = null,
  createdAt = new Date(),
}: {
  name: string;
  frequency?: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  createdAt?: Date;
}) {
  const [{ id }] = await sql()<{ id: number }[]>`
    insert into contacts (name, contact_frequency, created_at)
    values (${name}, ${frequency}, ${createdAt})
    returning id
  `;
  return id;
}

/** A note written at `createdAt`, as if it had been added back then. */
export async function makeNote(contactId: number, createdAt: Date, body = "Созвонились") {
  await sql()`insert into notes (contact_id, body, created_at) values (${contactId}, ${body}, ${createdAt})`;
}

export async function closeDb() {
  await client?.end();
  client = undefined;
}
