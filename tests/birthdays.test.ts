import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createContactAction, updateContactAction } from "@/app/actions";
import { getDb } from "@/db";
import { contacts } from "@/db/schema";
import {
  appToday,
  birthDateError,
  daysUntil,
  fullYears,
  nextBirthday,
  parseBirthDay,
  parseBirthYear,
} from "@/lib/birthdays";
import {
  createContact,
  getContact,
  listContacts,
  listUpcomingBirthdays,
  updateContact,
} from "@/lib/contacts";
import { formatBirthDate, formatBirthdayWhen } from "@/lib/format";
import { contactInputSchema, contactUpdateSchema } from "@/lib/validation";

import { closeDb, makeContact, makeUser, resetDb, rowCount } from "./helpers/db";
import { addDays, moscowToday } from "./helpers/days";
import { signInAs } from "./shims/current-user";

/*
 * openspec/changes/birthdays: the date of birth of a contact. The scenarios that need a browser
 * (the order of the blocks, tapping a row, the search, the group filter) are in
 * e2e/birthdays.spec.ts.
 */

// The day the examples in openspec/changes/birthdays/specs/birthdays/spec.md happen on.
const TODAY = "2026-10-15";

/** The fields of the contact form left empty. */
const emptyForm = { about: "", howWeMet: "", phone: "", email: "", firstNote: "" };

const formData = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

/** What a server action answers; a redirect (the action's "saved") is an answer too. */
async function submit<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    if (!digest?.startsWith("NEXT_REDIRECT")) throw error;
    return { redirectedTo: digest };
  }
}

// Every test starts with an empty database and one user whose data it works with.
let owner: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  await resetDb();
  owner = await makeUser();
  signInAs(owner.id);
});
afterAll(closeDb);

/** The name of the table constraint that rejected the insert, or null when it was accepted. */
async function rejectedBy(fields: Partial<typeof contacts.$inferInsert>) {
  try {
    await getDb()
      .insert(contacts)
      .values({ name: "Анна Смирнова", ...fields, userId: owner.id });
    return null;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string; message?: string } }).cause;
    return cause?.constraint_name ?? `not a constraint: ${cause?.message ?? String(error)}`;
  }
}

describe("Дата рождения в базе", () => {
  it("contact with a day, a month and a year of birth is saved and read back", async () => {
    const saved = await makeContact(owner.id, {
      name: "Анна Смирнова",
      birthDay: 18,
      birthMonth: 10,
      birthYear: 1990,
    });

    const contact = await getContact(owner.id, saved.id);
    expect(contact).toMatchObject({ birthDay: 18, birthMonth: 10, birthYear: 1990 });
  });

  it("contact without a date of birth has three empty fields", async () => {
    const saved = await makeContact(owner.id, { name: "Анна Смирнова" });

    const contact = await getContact(owner.id, saved.id);
    expect(contact).toMatchObject({ birthDay: null, birthMonth: null, birthYear: null });
  });

  it("a day and a month without a year are accepted", async () => {
    expect(await rejectedBy({ birthDay: 29, birthMonth: 2 })).toBeNull();
  });

  it("the database rejects month 13", async () => {
    expect(await rejectedBy({ birthDay: 1, birthMonth: 13 })).toBe("contacts_birth_month_check");
  });

  it("the database rejects 31 April", async () => {
    expect(await rejectedBy({ birthDay: 31, birthMonth: 4 })).toBe("contacts_birth_day_check");
  });

  it("the database rejects a year without a day and a month", async () => {
    expect(await rejectedBy({ birthYear: 1990 })).toBe("contacts_birth_date_check");
  });

  it("the database rejects a day without a month", async () => {
    expect(await rejectedBy({ birthDay: 18 })).toBe("contacts_birth_date_check");
  });

  it("the database rejects the year 1850", async () => {
    expect(await rejectedBy({ birthDay: 18, birthMonth: 10, birthYear: 1850 })).toBe(
      "contacts_birth_year_check",
    );
  });
});

describe("Дата рождения на странице контакта", () => {
  it("Дата с годом", () => {
    expect(formatBirthDate(18, 10, 1990, TODAY)).toBe("18 октября 1990 · 35 лет");
  });

  it("Возраст прибавляется в день рождения", () => {
    expect(formatBirthDate(15, 10, 1990, TODAY)).toBe("15 октября 1990 · 36 лет");
    expect(formatBirthDate(16, 10, 1990, TODAY)).toBe("16 октября 1990 · 35 лет");
  });

  it("Дата без года", () => {
    expect(formatBirthDate(18, 10, null, TODAY)).toBe("18 октября");
  });

  it("Человеку меньше года", () => {
    expect(formatBirthDate(3, 3, 2026, TODAY)).toBe("3 марта 2026");
  });

  it("Даты нет — строки нет", () => {
    expect(formatBirthDate(null, null, null, TODAY)).toBeNull();
  });

  it("the age is written with the right Russian form of the word", () => {
    expect(formatBirthDate(15, 10, 2025, TODAY)).toBe("15 октября 2025 · 1 год");
    expect(formatBirthDate(15, 10, 2024, TODAY)).toBe("15 октября 2024 · 2 года");
    expect(formatBirthDate(15, 10, 2005, TODAY)).toBe("15 октября 2005 · 21 год");
  });
});

describe("Правила дней рождения", () => {
  it("the next birthday is this year when it has not passed and next year when it has", () => {
    expect(nextBirthday(10, 18, TODAY)).toBe("2026-10-18");
    expect(nextBirthday(10, 14, TODAY)).toBe("2027-10-14");
  });

  it("a birthday today is today", () => {
    expect(nextBirthday(10, 15, TODAY)).toBe(TODAY);
    expect(daysUntil(nextBirthday(10, 15, TODAY), TODAY)).toBe(0);
  });

  it("29 February is celebrated on 28 February in 2027 and on 29 February in 2028", () => {
    expect(nextBirthday(2, 29, "2027-02-25")).toBe("2027-02-28");
    expect(nextBirthday(2, 29, "2028-02-25")).toBe("2028-02-29");
  });

  it("29 February: after 28 February of a common year the next one is the leap day", () => {
    expect(nextBirthday(2, 29, "2027-02-28")).toBe("2027-02-28");
    expect(nextBirthday(2, 29, "2027-03-01")).toBe("2028-02-29");
    expect(nextBirthday(2, 29, "2028-03-01")).toBe("2029-02-28");
  });

  it("2 January is next year when today is 28 December, 5 days away", () => {
    const next = nextBirthday(1, 2, "2026-12-28");
    expect(next).toBe("2027-01-02");
    expect(daysUntil(next, "2026-12-28")).toBe(5);
  });

  it("the days until a birthday are counted across the end of a month and of a year", () => {
    expect(daysUntil("2026-11-02", "2026-10-30")).toBe(3);
    expect(daysUntil("2027-01-05", "2026-12-28")).toBe(8);
  });

  it("full years: the day before, on and after the birthday", () => {
    const born = { day: 18, month: 10, year: 1990 };
    expect(fullYears(born, "2026-10-17")).toBe(35);
    expect(fullYears(born, "2026-10-18")).toBe(36);
    expect(fullYears(born, "2026-10-19")).toBe(36);
  });

  it("full years: born on 29 February, a common year counts from 28 February", () => {
    const born = { day: 29, month: 2, year: 2000 };
    expect(fullYears(born, "2027-02-27")).toBe(26);
    expect(fullYears(born, "2027-02-28")).toBe(27);
    expect(fullYears(born, "2027-03-01")).toBe(27);
    expect(fullYears(born, "2028-02-28")).toBe(27);
    expect(fullYears(born, "2028-02-29")).toBe(28);
  });

  it("full years: no year of birth, no age", () => {
    expect(fullYears({ day: 18, month: 10, year: null }, TODAY)).toBeNull();
  });

  it("today is a Moscow calendar day, whatever the time zone of the server", () => {
    // 22:30 UTC on 14 October is already 01:30 on 15 October in Moscow.
    expect(appToday(new Date("2026-10-14T22:30:00Z"))).toBe("2026-10-15");
    expect(appToday(new Date("2026-10-14T20:30:00Z"))).toBe("2026-10-14");
  });
});

describe("Дата рождения в формах контакта", () => {
  it("Контакт с полной датой рождения", async () => {
    const fields = contactInputSchema.parse({
      ...emptyForm,
      name: "Анна Смирнова",
      birthDay: "18",
      birthMonth: "10",
      birthYear: "1990",
    });
    expect(fields).toMatchObject({ birthDay: 18, birthMonth: 10, birthYear: 1990 });

    const id = await createContact(owner.id, fields);

    expect(await getContact(owner.id, id)).toMatchObject({
      birthDay: 18,
      birthMonth: 10,
      birthYear: 1990,
    });
  });

  it("Дата рождения без года", async () => {
    const fields = contactInputSchema.parse({
      ...emptyForm,
      name: "Анна Смирнова",
      birthDay: "3",
      birthMonth: "3",
      birthYear: "",
    });

    const id = await createContact(owner.id, fields);

    expect(await getContact(owner.id, id)).toMatchObject({
      birthDay: 3,
      birthMonth: 3,
      birthYear: null,
    });
  });

  it("Контакт без даты рождения", async () => {
    // The form fields of the date may be missing altogether, as in the callers from before.
    const fields = contactInputSchema.parse({ ...emptyForm, name: "Анна Смирнова" });

    const id = await createContact(owner.id, fields);

    expect(await getContact(owner.id, id)).toMatchObject({
      birthDay: null,
      birthMonth: null,
      birthYear: null,
    });
    expect((await listContacts(owner.id, "", { kind: "all" })).map((row) => row.name)).toEqual([
      "Анна Смирнова",
    ]);
  });

  it("Изменение даты рождения", async () => {
    const { id } = await makeContact(owner.id, {
      name: "Анна Смирнова",
      birthDay: 18,
      birthMonth: 10,
      birthYear: 1990,
    });

    const fields = contactUpdateSchema.parse({
      ...emptyForm,
      name: "Анна Смирнова",
      birthDay: "18",
      birthMonth: "11",
      birthYear: "1990",
    });
    expect(await updateContact(owner.id, id, fields)).toBe(true);

    expect(await getContact(owner.id, id)).toMatchObject({
      birthDay: 18,
      birthMonth: 11,
      birthYear: 1990,
    });
  });

  it("Удаление даты рождения", async () => {
    const [, month, day] = addDays(moscowToday(), 1).split("-").map(Number);
    const { id } = await makeContact(owner.id, {
      name: "Анна Смирнова",
      birthDay: day,
      birthMonth: month,
      birthYear: 1990,
    });
    expect((await listUpcomingBirthdays(owner.id)).map((row) => row.name)).toEqual([
      "Анна Смирнова",
    ]);

    const fields = contactUpdateSchema.parse({
      ...emptyForm,
      name: "Анна Смирнова",
      birthDay: "",
      birthMonth: "",
      birthYear: "",
    });
    expect(await updateContact(owner.id, id, fields)).toBe(true);

    expect(await getContact(owner.id, id)).toMatchObject({
      birthDay: null,
      birthMonth: null,
      birthYear: null,
    });
    expect(await listUpcomingBirthdays(owner.id)).toEqual([]);
  });
});

describe("Проверка даты рождения", () => {
  // The day of the examples of the spec: 15 October 2026. Only the clock of the code is moved; the
  // database and the timers stay real.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  /** Sends the "Новый контакт" form with this date of birth. */
  const createWith = (day: string, month: string, year: string) =>
    submit(() =>
      createContactAction(
        {},
        formData({
          ...emptyForm,
          name: "Анна Смирнова",
          birthDay: day,
          birthMonth: month,
          birthYear: year,
        }),
      ),
    );

  /** Checks that the form was refused with this message under "Дата рождения" and kept its input. */
  async function expectRefused(
    answer: Awaited<ReturnType<typeof createWith>>,
    message: string,
    typed: { birthDay: string; birthMonth: string; birthYear: string },
  ) {
    expect(answer).toMatchObject({ errors: { birthDate: message }, values: typed });
    expect(await rowCount("contacts")).toBe(0);
  }

  it("Указан только день", async () => {
    const answer = await createWith("18", "", "");

    await expectRefused(answer, "Укажите день и месяц", {
      birthDay: "18",
      birthMonth: "",
      birthYear: "",
    });
  });

  it("Год без дня и месяца", async () => {
    const answer = await createWith("", "", "1990");

    await expectRefused(answer, "Укажите день и месяц", {
      birthDay: "",
      birthMonth: "",
      birthYear: "1990",
    });
  });

  it("Такого дня нет в месяце", async () => {
    const answer = await createWith("31", "4", "");

    await expectRefused(answer, "Такой даты нет", {
      birthDay: "31",
      birthMonth: "4",
      birthYear: "",
    });
  });

  it("29 февраля", async () => {
    await expectRefused(await createWith("29", "2", "2023"), "Такой даты нет", {
      birthDay: "29",
      birthMonth: "2",
      birthYear: "2023",
    });

    expect(await createWith("29", "2", "2024")).toHaveProperty("redirectedTo");
    expect(await createWith("29", "2", "")).toHaveProperty("redirectedTo");
    expect(await rowCount("contacts")).toBe(2);
  });

  it("Неверный год", async () => {
    for (const year of ["1850", "90", "2027"]) {
      await expectRefused(await createWith("18", "10", year), "Проверьте год", {
        birthDay: "18",
        birthMonth: "10",
        birthYear: year,
      });
    }
    // The same for "next year", worked out for any "today", also on 31 December.
    expect(birthDateError(18, 10, 2027, "2026-10-15")).toBe("Проверьте год");
    expect(birthDateError(18, 10, 2027, "2026-12-31")).toBe("Проверьте год");
  });

  it("Дата ещё не наступила", async () => {
    await expectRefused(await createWith("20", "10", "2026"), "Эта дата ещё не наступила", {
      birthDay: "20",
      birthMonth: "10",
      birthYear: "2026",
    });
    expect(birthDateError(20, 10, 2026, "2026-10-15")).toBe("Эта дата ещё не наступила");
    // Today and the days before it in the current year are fine.
    expect(birthDateError(15, 10, 2026, "2026-10-15")).toBeNull();
    expect(birthDateError(14, 10, 2026, "2026-10-15")).toBeNull();
  });

  it("the same checks apply when an existing contact is changed", async () => {
    const { id } = await makeContact(owner.id, {
      name: "Анна Смирнова",
      birthDay: 18,
      birthMonth: 10,
      birthYear: 1990,
    });

    const answer = await submit(() =>
      updateContactAction(
        id,
        {},
        formData({
          ...emptyForm,
          name: "Анна Смирнова",
          birthDay: "31",
          birthMonth: "4",
          birthYear: "1990",
        }),
      ),
    );

    expect(answer).toMatchObject({
      errors: { birthDate: "Такой даты нет" },
      values: { birthDay: "31", birthMonth: "4", birthYear: "1990" },
    });
    expect(await getContact(owner.id, id)).toMatchObject({
      birthDay: 18,
      birthMonth: 10,
      birthYear: 1990,
    });
  });

  it("the date is checked by the server even if the form did not check it", () => {
    expect(
      contactInputSchema.safeParse({
        ...emptyForm,
        name: "Анна Смирнова",
        birthDay: "31",
        birthMonth: "4",
        birthYear: "",
      }).success,
    ).toBe(false);
    expect(birthDateError(null, null, null, "2026-10-15")).toBeNull();
    expect(birthDateError(parseBirthDay("x"), 10, null, "2026-10-15")).toBe("Такой даты нет");
    expect(appToday()).toBe("2026-10-15");
  });

  it("a year must have four digits, a day and a month one or two", () => {
    expect(parseBirthYear("1990")).toBe(1990);
    expect(parseBirthYear("")).toBeNull();
    expect(parseBirthYear("90")).toBeNaN();
    expect(parseBirthYear("01990")).toBeNaN();
    expect(parseBirthYear("1e3")).toBeNaN();
    expect(parseBirthDay("07")).toBe(7);
    expect(parseBirthDay("0x1")).toBeNaN();
    expect(parseBirthDay("-1")).toBeNaN();
  });
});

/** A contact with a date of birth, written straight into the database. */
const makeBorn = (name: string, day: number, month: number, year: number | null = null) =>
  makeContact(owner.id, { name, birthDay: day, birthMonth: month, birthYear: year });

/** The block "Скоро день рождения" for the given "today": the names in the order of the block. */
const blockNames = async (today: string) =>
  (await listUpcomingBirthdays(owner.id, today)).map((row) => row.name);

/** The line under the name in the block, as the owner reads it. */
const blockLines = async (today: string) =>
  (await listUpcomingBirthdays(owner.id, today)).map(
    (row) => `${row.name}: ${formatBirthdayWhen(row.daysUntil, row.next, row.turningAge)}`,
  );

describe("Блок «Скоро день рождения» на главной", () => {
  it("Кто попадает в блок", async () => {
    await makeBorn("Первый", 14, 10);
    await makeBorn("Второй", 15, 10);
    await makeBorn("Третий", 18, 10);
    await makeBorn("Четвёртый", 22, 10);
    await makeBorn("Пятый", 23, 10);

    const rows = await listUpcomingBirthdays(owner.id, TODAY);

    // The heading says "Скоро день рождения · 3": the number of the rows.
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.name)).toEqual(["Второй", "Третий", "Четвёртый"]);
  });

  it("Контакт остаётся в общем списке", async () => {
    await makeBorn("Анна Смирнова", 16, 10);

    expect(await blockNames(TODAY)).toEqual(["Анна Смирнова"]);
    expect((await listContacts(owner.id, "", { kind: "all" })).map((row) => row.name)).toEqual([
      "Анна Смирнова",
    ]);
  });
});

describe("Строка в блоке «Скоро день рождения»", () => {
  it("День рождения сегодня", async () => {
    await makeBorn("Анна Смирнова", 15, 10, 1990);

    expect(await blockLines(TODAY)).toEqual(["Анна Смирнова: Сегодня · исполняется 36"]);
  });

  it("День рождения завтра, год неизвестен", async () => {
    await makeBorn("Анна Смирнова", 16, 10);

    expect(await blockLines(TODAY)).toEqual(["Анна Смирнова: Завтра, 16 октября"]);
  });

  it("День рождения через несколько дней", async () => {
    await makeBorn("Анна Смирнова", 18, 10, 1990);

    expect(await blockLines(TODAY)).toEqual([
      "Анна Смирнова: Через 3 дня, 18 октября · исполнится 36",
    ]);
  });

  it("the days are written with the right Russian form of the word", async () => {
    await makeBorn("Два", 17, 10);
    await makeBorn("Пять", 20, 10);
    await makeBorn("Семь", 22, 10);

    expect(await blockLines(TODAY)).toEqual([
      "Два: Через 2 дня, 17 октября",
      "Пять: Через 5 дней, 20 октября",
      "Семь: Через 7 дней, 22 октября",
    ]);
  });
});

describe("Порядок в блоке «Скоро день рождения»", () => {
  it("Ближайшие сверху", async () => {
    await makeBorn("Анна", 20, 10);
    await makeBorn("Борис", 15, 10);
    await makeBorn("Вера", 16, 10);

    expect(await blockNames(TODAY)).toEqual(["Борис", "Вера", "Анна"]);
  });

  it("Один день — по алфавиту", async () => {
    await makeBorn("Борис", 18, 10);
    await makeBorn("Анна", 18, 10);

    expect(await blockNames(TODAY)).toEqual(["Анна", "Борис"]);
  });
});

describe("Дни рождения после Нового года", () => {
  it("Через Новый год", async () => {
    await makeBorn("Анна Смирнова", 2, 1);
    await makeBorn("Борис Орлов", 5, 1);

    expect(await blockLines("2026-12-28")).toEqual(["Анна Смирнова: Через 5 дней, 2 января"]);
  });
});

describe("Родившиеся 29 февраля", () => {
  it("Невисокосный год", async () => {
    await makeBorn("Анна Смирнова", 29, 2, 2000);

    expect(await blockLines("2027-02-25")).toEqual([
      "Анна Смирнова: Через 3 дня, 28 февраля · исполнится 27",
    ]);
  });

  it("Високосный год", async () => {
    await makeBorn("Анна Смирнова", 29, 2);

    expect(await blockLines("2028-02-25")).toEqual(["Анна Смирнова: Через 4 дня, 29 февраля"]);
  });
});

describe("Когда блока «Скоро день рождения» нет", () => {
  it("Ближайших дней рождения нет", async () => {
    await makeBorn("Анна Смирнова", 14, 10);
    await makeBorn("Борис Орлов", 23, 10);
    await makeContact(owner.id, { name: "Вера Кузнецова" });

    expect(await listUpcomingBirthdays(owner.id, TODAY)).toEqual([]);
  });
});
