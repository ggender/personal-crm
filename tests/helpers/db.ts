import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { contacts, type NewContact, notes, users } from "@/db/schema";

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

/** A user who has signed in before, as the login leaves him: just the row with the email. */
export async function makeUser(email = `user-${randomUUID()}@example.test`) {
  const [row] = await testDb().insert(users).values({ name: "", email }).returning();
  return row;
}

/** A contact of this user. */
export async function makeContact(
  userId: string,
  fields: Partial<Omit<NewContact, "userId">> & { name: string },
) {
  const [row] = await testDb()
    .insert(contacts)
    .values({ ...fields, userId })
    .returning();
  return row;
}

/** A group of this user; returns its id. */
export async function makeGroup(userId: string, name: string) {
  const [row] = await testDb().execute<{ id: number }>(
    sql`insert into groups (name, user_id) values (${name}, ${userId}) returning id`,
  );
  return row.id;
}

export async function addMember(groupId: number, contactId: number) {
  await testDb().execute(
    sql`insert into group_members (group_id, contact_id) values (${groupId}, ${contactId})`,
  );
}

/** Several contacts of this user at once; returns them in the order of the names. */
export async function makeContacts(userId: string, names: string[]) {
  const made = [];
  for (const name of names) made.push(await makeContact(userId, { name }));
  return made;
}

/** A note written at `createdAt`, as if it had been added back then. */
export async function makeNote(contactId: number, createdAt: Date, body = "Созвонились") {
  const [row] = await testDb().insert(notes).values({ contactId, body, createdAt }).returning();
  return row;
}
