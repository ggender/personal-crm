import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  assertTestDatabaseUrl,
  closeDb,
  makeContact,
  makeUser,
  resetDb,
  rowCount,
} from "./helpers/db";

describe("test database helpers", () => {
  afterAll(closeDb);
  beforeEach(resetDb);

  it("refuses a database whose name does not end with _test", () => {
    expect(() => assertTestDatabaseUrl("postgres://crm:secret@localhost:5433/crm")).toThrow(
      /_test/,
    );
    expect(() =>
      assertTestDatabaseUrl("postgres://crm:secret@localhost:5433/crm_test"),
    ).not.toThrow();
  });

  it("leaves contacts and notes empty after a reset", async () => {
    const user = await makeUser();
    await makeContact(user.id, { name: "Иван Петров" });
    expect(await rowCount("contacts")).toBe(1);

    await resetDb();

    expect(await rowCount("contacts")).toBe(0);
    expect(await rowCount("notes")).toBe(0);
  });
});
