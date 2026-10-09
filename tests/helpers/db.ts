import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { contacts, type NewContact } from "@/db/schema";

import { assertTestDatabaseUrl } from "../test-database-url.mts";

export { assertTestDatabaseUrl };

/** The app's own connection, after checking that it points to a test database. */
function testDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set for the tests.");
  assertTestDatabaseUrl(url);
  return getDb();
}

/** Empties every table in the public schema and restarts the id counters. */
export async function resetDb() {
  const db = testDb();
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (tables.length === 0) return;
  const names = sql.join(
    tables.map(({ tablename }) => sql.identifier(tablename)),
    sql`, `,
  );
  await db.execute(sql`truncate ${names} restart identity cascade`);
}

export async function closeDb() {
  await testDb().$client.end();
}

export async function rowCount(table: string) {
  const [row] = await testDb().execute<{ value: number }>(
    sql`select count(*)::int as value from ${sql.identifier(table)}`,
  );
  return row.value;
}

export async function makeContact(fields: Partial<NewContact> & { name: string }) {
  const [row] = await testDb().insert(contacts).values(fields).returning();
  return row;
}

export async function makeGroup(name: string) {
  const [row] = await testDb().execute<{ id: number }>(
    sql`insert into groups (name) values (${name}) returning id`,
  );
  return row.id;
}

export async function addMember(groupId: number, contactId: number) {
  await testDb().execute(
    sql`insert into group_members (group_id, contact_id) values (${groupId}, ${contactId})`,
  );
}

/** Several contacts at once; returns them in the order of the names. */
export async function makeContacts(names: string[]) {
  const made = [];
  for (const name of names) made.push(await makeContact({ name }));
  return made;
}
