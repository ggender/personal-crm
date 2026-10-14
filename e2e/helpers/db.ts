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

/** A user straight in the database, as if he had signed in before; returns his id. */
export async function makeUser(email: string) {
  const [{ id }] = await sql()<{ id: string }[]>`
    insert into users (name, email) values ('', ${email}) returning id
  `;
  return id;
}

/** The id of the user with this email, who has signed in through the app. */
export async function userIdOf(email: string) {
  const [user] = await usersWithEmail(email);
  if (!user) throw new Error(`Nobody has signed in as ${email}`);
  return user.id;
}

/** Adds contacts of this user straight to the database, as if they had been added before. */
export async function makeContacts(userId: string, names: string[]) {
  const db = sql();
  for (const name of names) {
    await db`insert into contacts (name, user_id) values (${name}, ${userId})`;
  }
}

/** Adds one contact of this user straight to the database; returns its id. */
export async function makeContact({
  userId,
  name,
  frequency = null,
  createdAt = new Date(),
}: {
  userId: string;
  name: string;
  frequency?: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  createdAt?: Date;
}) {
  const [{ id }] = await sql()<{ id: number }[]>`
    insert into contacts (name, contact_frequency, created_at, user_id)
    values (${name}, ${frequency}, ${createdAt}, ${userId})
    returning id
  `;
  return id;
}

/** A note written at `createdAt`, as if it had been added back then. */
export async function makeNote(contactId: number, createdAt: Date, body = "Созвонились") {
  await sql()`insert into notes (contact_id, body, created_at) values (${contactId}, ${body}, ${createdAt})`;
}

/** Adds one group of this user straight to the database; returns its id. */
export async function makeGroup(userId: string, name: string) {
  const [{ id }] = await sql()<{ id: number }[]>`
    insert into groups (name, user_id) values (${name}, ${userId}) returning id
  `;
  return id;
}

/** Puts the contact into the group straight in the database. */
export async function addMember(groupId: number, contactId: number) {
  await sql()`insert into group_members (group_id, contact_id) values (${groupId}, ${contactId})`;
}

/** The people who have signed in: the id and the email, as Better Auth stored them. */
export async function usersWithEmail(email: string) {
  return sql()<{ id: string; email: string; name: string }[]>`
    select id, email, name from users where email = ${email}
  `;
}

export async function countLoginEmails(email: string) {
  const [{ value }] = await sql()<{ value: number }[]>`
    select count(*)::int as value from login_emails where email = ${email}
  `;
  return value;
}

export async function countSessions(email: string) {
  const [{ value }] = await sql()<{ value: number }[]>`
    select count(*)::int as value from sessions s join users u on u.id = s.user_id
    where u.email = ${email}
  `;
  return value;
}

/*
 * Time travel for the login tests: instead of waiting minutes or days, move the dates in the
 * database back. Nothing in the app is changed or skipped.
 */

/** Makes the unused login links of this address `minutes` minutes older. */
export async function ageLoginLinks(email: string, minutes: number) {
  await sql()`
    update verifications set expires_at = expires_at - make_interval(mins => ${minutes}::int)
    where identifier like 'magic-link:%' and value::jsonb ->> 'email' = ${email}
  `;
}

/** Makes only the oldest letter of this address `minutes` minutes older. */
export async function ageOldestLoginEmail(email: string, minutes: number) {
  await sql()`
    update login_emails set sent_at = sent_at - make_interval(mins => ${minutes}::int)
    where id = (select id from login_emails where email = ${email} order by sent_at, id limit 1)
  `;
}

/** Makes the sessions of this address `days` days older: last visit and end of the login. */
export async function ageSessions(email: string, days: number) {
  await sql()`
    update sessions set
      expires_at = expires_at - make_interval(days => ${days}::int),
      updated_at = updated_at - make_interval(days => ${days}::int)
    where user_id in (select id from users where email = ${email})
  `;
}

/** Sets how many days the login of this address has left and when it was last renewed. */
export async function setSessionAge(email: string, { daysLeft, lastVisitDaysAgo }: SessionAge) {
  await sql()`
    update sessions set
      expires_at = now() + make_interval(days => ${daysLeft}::int),
      updated_at = now() - make_interval(days => ${lastVisitDaysAgo}::int)
    where user_id in (select id from users where email = ${email})
  `;
}

type SessionAge = { daysLeft: number; lastVisitDaysAgo: number };

/** Days until the login of this address ends (the longest of its sessions). */
export async function sessionDaysLeft(email: string) {
  const [{ days }] = await sql()<{ days: number }[]>`
    select coalesce(extract(epoch from (max(s.expires_at) - now())) / 86400, 0)::float as days
    from sessions s join users u on u.id = s.user_id where u.email = ${email}
  `;
  return days;
}

export async function closeDb() {
  await client?.end();
  client = undefined;
}
