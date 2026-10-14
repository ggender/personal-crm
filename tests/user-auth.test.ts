import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { requestLoginLinkAction } from "@/app/login/actions";
import { getDb } from "@/db";
import { loginEmailSchema } from "@/lib/validation";

import { closeDb, resetDb, rowCount } from "./helpers/db";

afterAll(closeDb);
beforeEach(resetDb);

describe("Запрос ссылки для входа", () => {
  it("Пробелы и большие буквы", () => {
    expect(loginEmailSchema.parse("  Anna@Example.COM  ")).toBe("anna@example.com");
    expect(loginEmailSchema.parse("anna@example.com")).toBe("anna@example.com");
  });
});

describe("Неверный адрес почты", () => {
  it("Неверный адрес в форме", () => {
    for (const value of ["", "   ", "anna", "anna@", "@example.com", "anna@@example.com"]) {
      const result = loginEmailSchema.safeParse(value);
      expect(result.success, `"${value}" must be refused`).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Проверьте адрес почты");
    }
  });

  it("Слишком длинный адрес", () => {
    const tooLong = `${"a".repeat(250)}@example.com`;
    expect(loginEmailSchema.safeParse(tooLong).success).toBe(false);
  });
});

describe("Письмо не удалось отправить", () => {
  // The action logs the failure for the server log; here that is expected, so keep it quiet.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // A link as an earlier request leaves it: only the fingerprint of the link is stored.
  async function insertEarlierLink(email: string, token: string) {
    const fingerprint = createHash("sha256").update(token).digest("hex");
    await getDb().execute(sql`
      insert into verifications (id, identifier, value, expires_at)
      values (gen_random_uuid(), ${`magic-link:${fingerprint}`},
              ${JSON.stringify({ type: "magic-link", email })}, now() + interval '10 minutes')
    `);
    return `magic-link:${fingerprint}`;
  }

  const identifiers = async () =>
    (await getDb().execute<{ identifier: string }>(sql`select identifier from verifications`)).map(
      (row) => row.identifier,
    );

  it("Почтовый сервис недоступен", async () => {
    const earlier = await insertEarlierLink("anna@example.com", "earlier-token");
    const formData = new FormData();
    formData.set("email", "anna@example.com");

    // SMTP_URL points to a port nobody listens on (vitest.config.mts).
    const state = await requestLoginLinkAction({}, formData);

    expect(state.error).toBe("Не удалось отправить письмо. Попробуйте ещё раз.");
    expect(state.sentTo).toBeUndefined();
    // The link that came before the failure still works; the one made for this request is gone.
    expect(await identifiers()).toEqual([earlier]);
    // A letter that did not go out does not count towards the limit.
    expect(await rowCount("login_emails")).toBe(0);
  });
});
