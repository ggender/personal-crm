import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { assertTestDatabaseUrl, closeDb, makeContact, resetDb, rowCount } from "./helpers/db";

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
    await makeContact({ name: "Иван Петров" });
    expect(await rowCount("contacts")).toBe(1);

    await resetDb();

    expect(await rowCount("contacts")).toBe(0);
    expect(await rowCount("notes")).toBe(0);
  });
});
