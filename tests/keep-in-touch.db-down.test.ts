import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getTestDatabaseUrl } from "./test-database-url.mts";

// The database is "down" for real: the connection string points to a port nobody listens on.
// The server actions answer before they reach revalidatePath, so they run outside Next.js.
const testUrl = getTestDatabaseUrl();
const closedPortUrl = new URL(testUrl);
closedPortUrl.port = "1";

beforeAll(() => {
  process.env.DATABASE_URL = closedPortUrl.toString();
});

afterAll(() => {
  process.env.DATABASE_URL = testUrl;
});

const SAVE_FAILED = "Не удалось сохранить. Попробуйте ещё раз.";

describe("Ошибка при сохранении «Не терять связь»", () => {
  // The actions log the failure for the server log; here that is expected, so keep it quiet.
  let logged: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("Сохранение частоты не удалось", async () => {
    const { setContactFrequencyAction } = await import("@/app/actions");

    const result = await setContactFrequencyAction(1, "monthly");

    expect(result).toEqual({ error: SAVE_FAILED });
    expect(logged).toHaveBeenCalledOnce();
  });

  it("Отметка не удалась", async () => {
    const { markContactedAction } = await import("@/app/actions");

    const result = await markContactedAction(1);

    expect(result).toEqual({ error: SAVE_FAILED });
    expect(logged).toHaveBeenCalledOnce();
  });

  it("Отмена отметки не удалась", async () => {
    const { undoContactedAction } = await import("@/app/actions");

    const result = await undoContactedAction(1, null, new Date().toISOString());

    expect(result).toEqual({ error: SAVE_FAILED });
    expect(logged).toHaveBeenCalledOnce();
  });
});
