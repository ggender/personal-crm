import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getTestDatabaseUrl } from "./test-database-url.mts";

// The database is "down" for real: the connection string points to a port nobody listens on.
// The server actions answer before they reach revalidatePath, so they run outside Next.js.
const testUrl = getTestDatabaseUrl();
const closedPortUrl = new URL(testUrl);
closedPortUrl.port = "1";

// The test database itself, reached around the app's own (broken) connection.
async function withTestDatabase<T>(run: (client: postgres.Sql) => Promise<T>) {
  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  // Start from no groups: other test files leave their rows behind.
  await withTestDatabase((client) => client`truncate groups restart identity cascade`);
  process.env.DATABASE_URL = closedPortUrl.toString();
});

afterAll(() => {
  process.env.DATABASE_URL = testUrl;
});

const countGroups = () =>
  withTestDatabase(async (client) => {
    const [{ value }] = await client`select count(*)::int as value from groups`;
    return value as number;
  });

describe("Ошибка при сохранении групп", () => {
  // The actions log the failure for the server log; here that is expected, so keep it quiet.
  let logged: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("Не удалось создать группу", async () => {
    const { createGroupAction } = await import("@/app/actions");
    const formData = new FormData();
    formData.set("name", "Теннис");

    const state = await createGroupAction({}, formData);

    expect(state.error).toBe("Не удалось сохранить. Попробуйте ещё раз.");
    expect(state.name).toBe("Теннис");
    expect(logged).toHaveBeenCalledOnce();
    expect(await countGroups()).toBe(0);
  });

  it("Не удалось отметить группу", async () => {
    const { setContactGroupAction } = await import("@/app/actions");

    const result = await setContactGroupAction(1, 1, true);

    expect(result).toEqual({ error: "Не удалось сохранить. Попробуйте ещё раз." });
    expect(logged).toHaveBeenCalledOnce();
  });
});
