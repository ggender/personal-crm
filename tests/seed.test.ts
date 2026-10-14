import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, makeUser, resetDb, rowCount } from "./helpers/db";
import { getTestDatabaseUrl } from "./test-database-url.mts";

const run = promisify(execFile);

/*
 * `pnpm db:seed` for real, as a separate process on the test database: the demo data goes to the
 * user with the email of the owner (OWNER_EMAIL), and to nobody else.
 */

beforeEach(resetDb);
afterAll(closeDb);

/** Runs scripts/seed.ts with the settings of the test; resolves with the exit code and output. */
async function seed(env: { OWNER_EMAIL?: string }) {
  try {
    const { stdout } = await run("pnpm", ["exec", "tsx", "scripts/seed.ts"], {
      env: {
        ...process.env,
        DATABASE_URL: getTestDatabaseUrl(),
        OWNER_EMAIL: env.OWNER_EMAIL ?? "",
      },
    });
    return { code: 0, output: stdout };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, output: `${failed.stdout ?? ""}${failed.stderr ?? ""}` };
  }
}

describe("Данные, которые уже были, достаются владельцу приложения", () => {
  it("Демо-данные у владельца", { timeout: 60_000 }, async () => {
    const other = await makeUser("other@example.test");

    // The owner's email is written the way it may stand in .env: capitals and spaces.
    const { code, output } = await seed({ OWNER_EMAIL: "  Owner@Example.Test " });

    expect(code, output).toBe(0);
    expect(await rowCount("contacts")).toBe(1000);
    const { getDb } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const owners = await getDb().execute<{ id: string; email: string }>(
      sql`select id, email from users where email = 'owner@example.test'`,
    );
    expect(owners).toHaveLength(1);
    const [{ ownerContacts }] = await getDb().execute<{ ownerContacts: number }>(
      sql`select count(*)::int as "ownerContacts" from contacts where user_id = ${owners[0].id}`,
    );
    expect(ownerContacts).toBe(1000);
    // Nobody else gets any of it, and the demo data has no groups.
    const [{ otherContacts }] = await getDb().execute<{ otherContacts: number }>(
      sql`select count(*)::int as "otherContacts" from contacts where user_id = ${other.id}`,
    );
    expect(otherContacts).toBe(0);
    expect(await rowCount("groups")).toBe(0);
    expect(await rowCount("notes")).toBeGreaterThan(0);
  });

  it("Заполнение без почты владельца", { timeout: 60_000 }, async () => {
    for (const OWNER_EMAIL of [undefined, "", "not-an-email"]) {
      const { code, output } = await seed({ OWNER_EMAIL });

      expect(code).not.toBe(0);
      expect(output).toContain("OWNER_EMAIL");
    }
    expect(await rowCount("contacts")).toBe(0);
    expect(await rowCount("users")).toBe(0);
  });

  it("Заполнение не трогает базу с контактами", { timeout: 60_000 }, async () => {
    const owner = await makeUser("owner@example.test");
    const { makeContact } = await import("./helpers/db");
    await makeContact(owner.id, { name: "Анна" });

    const { code, output } = await seed({ OWNER_EMAIL: "owner@example.test" });

    expect(code, output).toBe(0);
    expect(output).toContain("seed skipped");
    expect(await rowCount("contacts")).toBe(1);
  });
});
