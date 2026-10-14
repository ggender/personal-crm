import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { applyMigrations, recreateDatabase } from "./prepare-test-database.mts";
import { getTestDatabaseUrl, withDatabaseName } from "./test-database-url.mts";

/*
 * drizzle/0004_data_owner.sql on a copy of the old database: the data that was there before the
 * login is given to the owner and nothing is lost. The migrations run for real, in a database of
 * their own (crm_migration_test) that every test creates anew.
 */
const url = withDatabaseName(getTestDatabaseUrl(), "crm_migration_test");

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

/** The migrations folder as it was when `lastTag` was the newest migration: the old database. */
function migrationsUpTo(lastTag: string) {
  const folder = mkdtempSync(join(tmpdir(), "crm-migrations-"));
  folders.push(folder);
  cpSync("drizzle", folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  const last = journal.entries.findIndex((entry) => entry.tag === lastTag);
  if (last < 0) throw new Error(`No migration ${lastTag}`);
  journal.entries = journal.entries.slice(0, last + 1);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

async function withDb<T>(run: (db: postgres.Sql) => Promise<T>) {
  const db = postgres(url, { max: 1, onnotice: () => {} });
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

/** What the old database held: contacts with notes, keep-in-touch marks, groups and members. */
async function fillOldDatabase() {
  await withDb(async (db) => {
    await db`insert into contacts (name, about, contact_frequency, last_contacted_at) values
      ('Анна Смирнова', 'Соседка', 'weekly', now() - interval '3 days'),
      ('Борис Орлов', null, 'yearly', null),
      ('Вера Кузнецова', 'Коллега', null, null)`;
    await db`insert into notes (contact_id, body) values (1, 'Созвонились'), (1, 'Договорились о встрече'), (3, 'Прислала контакты')`;
    await db`insert into groups (name) values ('Теннис'), ('Друзья')`;
    await db`insert into group_members (group_id, contact_id) values (1, 1), (1, 2), (2, 3)`;
  });
}

const SNAPSHOT_COLUMNS =
  "id, name, about, how_we_met, phone, email, contact_frequency, last_contacted_at, created_at, updated_at";

/** Everything the migration must leave alone, in a form that can be compared. */
async function snapshot() {
  return withDb(async (db) => ({
    contacts: await db.unsafe(`select ${SNAPSHOT_COLUMNS} from contacts order by id`),
    notes: await db`select * from notes order by id`,
    groups: await db`select id, name, created_at from groups order by id`,
    members: await db`select * from group_members order by group_id, contact_id`,
  }));
}

beforeEach(async () => {
  await recreateDatabase(url);
  await applyMigrations(url, { migrationsFolder: migrationsUpTo("0002_groups") });
});

describe("Данные, которые уже были, достаются владельцу приложения", () => {
  it("Владелец видит всё, что было", async () => {
    await fillOldDatabase();
    const before = await snapshot();

    // The owner's email is written with spaces and capitals, as it may be typed into .env.
    await applyMigrations(url, { ownerEmail: "  Owner@Example.Test " });

    expect(await snapshot()).toEqual(before);
    await withDb(async (db) => {
      const owners = await db`select id, email, name, email_verified from users`;
      expect(owners).toHaveLength(1);
      expect(owners[0]).toMatchObject({
        email: "owner@example.test",
        name: "",
        email_verified: false,
      });
      const ownerId = owners[0].id;
      expect(await db`select id from contacts where user_id = ${ownerId}`).toHaveLength(3);
      expect(await db`select id from groups where user_id = ${ownerId}`).toHaveLength(2);
      expect(
        await db`select id from contacts where user_id is distinct from ${ownerId}`,
      ).toHaveLength(0);
      expect(
        await db`select id from groups where user_id is distinct from ${ownerId}`,
      ).toHaveLength(0);
    });
  });

  it("Другой пользователь после выкатки", async () => {
    await fillOldDatabase();
    await applyMigrations(url, { ownerEmail: "owner@example.test" });

    await withDb(async (db) => {
      const [other] =
        await db`insert into users (name, email) values ('', 'other@example.test') returning id`;
      expect(await db`select id from contacts where user_id = ${other.id}`).toHaveLength(0);
      expect(await db`select id from groups where user_id = ${other.id}`).toHaveLength(0);
      // And the owner's data is not his: he can have a group with the same name.
      await db`insert into groups (name, user_id) values ('Теннис', ${other.id})`;
      expect(await db`select id from groups where lower(name) = 'теннис'`).toHaveLength(2);
    });
  });

  it("Миграция без почты владельца при наличии данных останавливается", async () => {
    await fillOldDatabase();
    const before = await snapshot();

    for (const ownerEmail of [undefined, "", "   ", "not-an-email"]) {
      await expect(applyMigrations(url, { ownerEmail })).rejects.toThrow(/OWNER_EMAIL/);
    }

    // Nothing changed: the old tables are as they were and the login tables were not created.
    expect(await snapshot()).toEqual(before);
    await withDb(async (db) => {
      const tables = await db`select tablename from pg_tables where schemaname = 'public'`;
      expect(tables.map((table) => table.tablename)).not.toContain("users");
      const columns =
        await db`select column_name from information_schema.columns where table_name = 'contacts'`;
      expect(columns.map((column) => column.column_name)).not.toContain("user_id");
    });
  });

  it("Пустая база без почты владельца", async () => {
    // No contacts and no groups: there is nothing to give away, so no email is needed.
    await applyMigrations(url, {});

    await withDb(async (db) => {
      expect(await db`select id from users`).toHaveLength(0);
      expect(await db`select id from contacts`).toHaveLength(0);
    });
  });
});
