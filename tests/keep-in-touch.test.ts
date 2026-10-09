import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  addNote,
  countNotes,
  createContact,
  getContact,
  getContactTouchStatus,
  listContacts,
  listOverdueContacts,
  markContacted,
  setContactFrequency,
  undoContacted,
  updateNote,
} from "@/lib/contacts";
import { formatDay, formatOverdue } from "@/lib/format";
import { CONTACT_FREQUENCY_LABELS, type ContactFrequency } from "@/lib/keep-in-touch";
import { contactInputSchema, contactUpdateSchema } from "@/lib/validation";

import { closeDb, makeContact, makeNote, resetDb } from "./helpers/db";
import {
  addDays,
  addMonths,
  daysAgo,
  daysBetween,
  moscowDay,
  moscowNoon,
  moscowToday,
} from "./helpers/days";

/** The fields of the "Новый контакт" form left empty. */
const emptyForm = { about: "", howWeMet: "", phone: "", email: "", firstNote: "" };

const overdueNames = async () => (await listOverdueContacts()).map((contact) => contact.name);

/** What the contact page says under the frequency, or null when it says nothing. */
async function touchText(contactId: number) {
  const status = await getContactTouchStatus(contactId);
  if (!status?.frequency) return null;
  return status.overdueDays > 0
    ? `Пора связаться: ${formatOverdue(status.overdueDays)}`
    : `Связаться не позже ${formatDay(status.dueDate)}`;
}

/** The last day to get in touch, "YYYY-MM-DD"; null without a frequency. */
async function dueDateOf(contactId: number) {
  const status = await getContactTouchStatus(contactId);
  return status?.frequency ? status.dueDate : null;
}

/** The line under the name in the "Пора связаться" block. */
const rowText = (row: { frequency: ContactFrequency; overdueDays: number }) =>
  `${CONTACT_FREQUENCY_LABELS[row.frequency]} · ${formatOverdue(row.overdueDays)}`;

/** A contact with the given frequency whose only note was written `days` days ago. */
async function contactWithNote(name: string, frequency: ContactFrequency | null, days: number) {
  const contact = await makeContact({
    name,
    contactFrequency: frequency,
    createdAt: daysAgo(days),
  });
  const note = await makeNote(contact.id, daysAgo(days));
  return { id: contact.id, noteId: note.id };
}

beforeEach(resetDb);
afterAll(closeDb);

describe("Частота общения задаётся на странице контакта", () => {
  it("У нового контакта частота не задана", async () => {
    const id = await createContact(contactInputSchema.parse({ ...emptyForm, name: "Анна" }));

    expect(await getContactTouchStatus(id)).toEqual({ frequency: null });
    expect(await touchText(id)).toBeNull();
  });

  it("Выбор сохраняется сразу", async () => {
    const { id } = await makeContact({ name: "Анна" });

    expect(await setContactFrequency(id, "monthly")).toBe(true);

    // A fresh read is what a reload or another browser gets.
    expect((await getContactTouchStatus(id))?.frequency).toBe("monthly");
  });

  it("Сброс частоты", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 10);
    expect(await overdueNames()).toEqual(["Анна"]);

    await setContactFrequency(id, null);

    expect(await overdueNames()).toEqual([]);
    expect(await getContactTouchStatus(id)).toEqual({ frequency: null });
    expect(await touchText(id)).toBeNull();
  });

  it("В формах поля нет", () => {
    for (const schema of [contactInputSchema, contactUpdateSchema]) {
      expect(Object.keys(schema.shape).filter((field) => /frequen|contacted/i.test(field))).toEqual(
        [],
      );
    }
  });
});

describe("Дата последнего общения", () => {
  it("Новая заметка начинает срок заново", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 10);
    expect(await overdueNames()).toEqual(["Анна"]);

    await addNote(id, "Встретились на даче");

    expect(await overdueNames()).toEqual([]);
    expect(await getContactTouchStatus(id)).toMatchObject({
      dueDate: addDays(moscowToday(), 7),
      overdueDays: -7,
    });
  });

  it("Отметка позже заметки", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 20);

    await markContacted(id);

    expect(await dueDateOf(id)).toBe(addDays(moscowToday(), 7));
    expect(await countNotes(id)).toBe(1);
  });

  it("Нет заметок и отметок — срок от даты добавления", async () => {
    const createdAt = daysAgo(45);
    const { id } = await makeContact({ name: "Анна", createdAt });

    await setContactFrequency(id, "monthly");

    const due = addMonths(moscowDay(createdAt), 1);
    const [row] = await listOverdueContacts();
    expect(row).toMatchObject({ id, overdueDays: daysBetween(due, moscowToday()) });
    expect(row.overdueDays).toBeGreaterThan(0);
  });

  it("Правка старой заметки не сбрасывает срок", async () => {
    const { id, noteId } = await contactWithNote("Анна", "weekly", 12);
    await makeNote(id, daysAgo(10));
    const [before] = await listOverdueContacts();
    expect(before.overdueDays).toBe(3);

    expect(await updateNote(id, noteId, "Исправленный текст")).toBe(true);

    const [after] = await listOverdueContacts();
    expect(after).toMatchObject({ id, overdueDays: 3 });
  });

  it("Заметка при добавлении контакта считается общением", async () => {
    const id = await createContact(
      contactInputSchema.parse({ ...emptyForm, name: "Анна", firstNote: "Познакомились" }),
    );

    await setContactFrequency(id, "weekly");

    expect(await touchText(id)).toBe(`Связаться не позже ${formatDay(addDays(moscowToday(), 7))}`);
  });
});

describe("Срок и просрочка", () => {
  it("В пределах срока", async () => {
    const { id } = await contactWithNote("Анна", "monthly", 5);

    const due = addMonths(moscowDay(daysAgo(5)), 1);
    expect(await getContactTouchStatus(id)).toMatchObject({ dueDate: due });
    expect(await touchText(id)).toBe(`Связаться не позже ${formatDay(due)}`);
    expect(await overdueNames()).toEqual([]);
  });

  it("Последний день срока — ещё не просрочен", async () => {
    const { id } = await makeContact({ name: "Анна", createdAt: daysAgo(30) });
    await makeNote(id, moscowNoon(addDays(moscowToday(), -7)));

    await setContactFrequency(id, "weekly");

    expect(await getContactTouchStatus(id)).toMatchObject({
      dueDate: moscowToday(),
      overdueDays: 0,
    });
    expect(await touchText(id)).toBe(`Связаться не позже ${formatDay(moscowToday())}`);
    expect(await overdueNames()).toEqual([]);
  });

  it("Срок прошёл", async () => {
    const { id } = await contactWithNote("Анна", null, 10);

    await setContactFrequency(id, "weekly");

    expect(await touchText(id)).toBe("Пора связаться: просрочено на 3 дня");
    const [row] = await listOverdueContacts();
    expect(row.name).toBe("Анна");
    expect(rowText(row)).toBe("Раз в неделю · просрочено на 3 дня");
  });

  it("Смена частоты не сбрасывает срок", async () => {
    const { id } = await contactWithNote("Анна", "quarterly", 40);
    expect(await overdueNames()).toEqual([]);

    await setContactFrequency(id, "monthly");

    const due = addMonths(moscowDay(daysAgo(40)), 1);
    const [row] = await listOverdueContacts();
    expect(row).toMatchObject({ id, overdueDays: daysBetween(due, moscowToday()) });
    expect(row.overdueDays).toBeGreaterThanOrEqual(9);
    expect(row.overdueDays).toBeLessThanOrEqual(12);
  });

  // Fixed past dates: the due date does not depend on today.
  const dueDateAfter = async (lastContact: Date, frequency: ContactFrequency) => {
    const { id } = await makeContact({
      name: "Анна",
      contactFrequency: frequency,
      createdAt: lastContact,
    });
    await makeNote(id, lastContact);
    return await dueDateOf(id);
  };

  it("Нет такого числа в месяце — последний день месяца", async () => {
    expect(await dueDateAfter(new Date("2025-01-31T12:00:00+03:00"), "monthly")).toBe("2025-02-28");
    expect(await dueDateAfter(new Date("2024-11-30T12:00:00+03:00"), "quarterly")).toBe(
      "2025-02-28",
    );
    expect(await dueDateAfter(new Date("2024-02-29T12:00:00+03:00"), "yearly")).toBe("2025-02-28");
  });

  it("Дни считаются по московскому времени", async () => {
    // 1 February 01:30 in Moscow is still 31 January in UTC.
    expect(await dueDateAfter(new Date("2025-01-31T22:30:00Z"), "weekly")).toBe("2025-02-08");
    // 31 January 23:30 in Moscow.
    expect(await dueDateAfter(new Date("2025-01-31T20:30:00Z"), "weekly")).toBe("2025-02-07");
  });
});

describe("Кнопка «Пообщались»", () => {
  it("Отметка на просроченном: срок от сегодня, заметок не прибавилось", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 17);
    expect(await touchText(id)).toBe("Пора связаться: просрочено на 10 дней");

    await markContacted(id);

    expect(await touchText(id)).toBe(`Связаться не позже ${formatDay(addDays(moscowToday(), 7))}`);
    expect(await countNotes(id)).toBe(1);
    expect(await overdueNames()).toEqual([]);
  });

  it("Отметка, когда срок ещё не прошёл", async () => {
    const { id } = await contactWithNote("Анна", "monthly", 13);
    expect(await dueDateOf(id)).toBe(addMonths(moscowDay(daysAgo(13)), 1));

    await markContacted(id);

    expect(await dueDateOf(id)).toBe(addMonths(moscowToday(), 1));
  });

  it("Отметка сохраняется", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 17);

    const mark = await markContacted(id);
    const right = await touchText(id);

    expect(mark).toEqual({ previous: null, marked: expect.any(Date) });
    expect((await getContact(id))?.lastContactedAt).toEqual(mark!.marked);
    expect(await touchText(id)).toBe(right);
  });

  it("Отмечен последний просроченный", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 10);
    expect(await overdueNames()).toEqual(["Анна"]);

    await markContacted(id);

    expect(await listOverdueContacts()).toEqual([]);
  });

  it("Несуществующий контакт", async () => {
    expect(await markContacted(999)).toBeNull();
  });
});

describe("Отмена отметки «Пообщались»", () => {
  it("Отмена возвращает прежнюю просрочку", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 10);
    const mark = await markContacted(id);
    expect(await overdueNames()).toEqual([]);

    expect(await undoContacted(id, mark!.previous, mark!.marked)).toBe(true);

    const [row] = await listOverdueContacts();
    expect(row).toMatchObject({ id, overdueDays: 3 });
    expect(await touchText(id)).toBe("Пора связаться: просрочено на 3 дня");
  });

  it("Отмена возвращает прежнюю отметку, а не пустоту", async () => {
    const earlier = daysAgo(17);
    const { id } = await makeContact({
      name: "Анна",
      contactFrequency: "weekly",
      createdAt: daysAgo(60),
      lastContactedAt: earlier,
    });
    const mark = await markContacted(id);
    expect(mark?.previous).toEqual(earlier);

    await undoContacted(id, mark!.previous, mark!.marked);

    expect((await getContact(id))?.lastContactedAt).toEqual(earlier);
    expect((await listOverdueContacts())[0]).toMatchObject({ id, overdueDays: 10 });
  });

  it("Время на отмену вышло: отметка осталась", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 10);
    const mark = await markContacted(id);

    // No undo: a later read still has the mark.
    expect((await getContact(id))?.lastContactedAt).toEqual(mark!.marked);
    expect(await touchText(id)).toBe(`Связаться не позже ${formatDay(addDays(moscowToday(), 7))}`);
  });

  it("Отмена не затирает более позднее нажатие", async () => {
    const { id } = await contactWithNote("Анна", "weekly", 10);
    const first = await markContacted(id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await markContacted(id);

    // E.g. "Отменить" in a tab that was pressed before another tab's "Пообщались".
    expect(await undoContacted(id, first!.previous, first!.marked)).toBe(false);

    expect((await getContact(id))?.lastContactedAt).toEqual(second!.marked);
    expect(await overdueNames()).toEqual([]);
  });
});

describe("Блок «Пора связаться» на главной", () => {
  it("Просроченные контакты видны в блоке", async () => {
    await contactWithNote("Борис Орлов", "weekly", 10);
    await contactWithNote("Анна Смирнова", "monthly", 42);
    await contactWithNote("Вера Кузнецова", "yearly", 400);
    await contactWithNote("Глеб Ершов", "weekly", 2);

    const overdue = await listOverdueContacts();

    const overdueSince = (days: number, months: number) =>
      daysBetween(addMonths(moscowDay(daysAgo(days)), months), moscowToday());
    expect(overdue).toEqual([
      { id: 3, name: "Вера Кузнецова", frequency: "yearly", overdueDays: overdueSince(400, 12) },
      { id: 2, name: "Анна Смирнова", frequency: "monthly", overdueDays: overdueSince(42, 1) },
      { id: 1, name: "Борис Орлов", frequency: "weekly", overdueDays: 3 },
    ]);
    expect(rowText(overdue[2])).toBe("Раз в неделю · просрочено на 3 дня");
  });

  it("Контакт остаётся в общем списке", async () => {
    await contactWithNote("Борис", "weekly", 10);
    await makeContact({ name: "Анна" });

    expect(await overdueNames()).toEqual(["Борис"]);
    const all = (await listContacts("", { kind: "all" })).map((contact) => contact.name);
    expect(all).toEqual(["Анна", "Борис"]);
  });

  it("Без частоты в блок не попадает", async () => {
    const { id } = await contactWithNote("Анна", null, 400);

    expect(await overdueNames()).toEqual([]);
    expect(await getContactTouchStatus(id)).toEqual({ frequency: null });
  });
});

describe("Порядок в блоке «Пора связаться»", () => {
  it("Сверху самые просроченные по дням", async () => {
    await contactWithNote("Анна", "weekly", 17);
    // A year and 40 days ago: "Раз в год" overdue by 40 days.
    const lastDay = addDays(addMonths(moscowToday(), -12), -40);
    const { id } = await makeContact({
      name: "Борис",
      contactFrequency: "yearly",
      createdAt: moscowNoon(lastDay),
    });
    await makeNote(id, moscowNoon(lastDay));

    const overdue = await listOverdueContacts();

    const yearlyOverdue = daysBetween(addMonths(lastDay, 12), moscowToday());
    expect(yearlyOverdue).toBe(40);
    expect(overdue.map(({ name, overdueDays }) => ({ name, overdueDays }))).toEqual([
      { name: "Борис", overdueDays: yearlyOverdue },
      { name: "Анна", overdueDays: 10 },
    ]);
  });

  it("Одинаковая просрочка — по алфавиту", async () => {
    await contactWithNote("Борис", "weekly", 10);
    await contactWithNote("Анна", "weekly", 10);

    expect(await overdueNames()).toEqual(["Анна", "Борис"]);
  });
});

describe("Когда блока «Пора связаться» нет", () => {
  it("Никто не просрочен", async () => {
    await contactWithNote("Анна", "weekly", 0);
    await makeContact({ name: "Борис", contactFrequency: "monthly" });
    await contactWithNote("Вера", null, 400);

    expect(await listOverdueContacts()).toEqual([]);
  });
});

describe("Тексты срока и просрочки", () => {
  it("Склонение дней", () => {
    expect(formatOverdue(1)).toBe("просрочено на 1 день");
    expect(formatOverdue(3)).toBe("просрочено на 3 дня");
    expect(formatOverdue(12)).toBe("просрочено на 12 дней");
    expect(formatOverdue(21)).toBe("просрочено на 21 день");
  });

  it("Дата срока: в этом году без года, в другом — с годом", () => {
    const year = Number(moscowToday().slice(0, 4));

    expect(formatDay(`${year}-10-14`)).toBe("14 октября");
    expect(formatDay(`${year + 1}-10-07`)).toBe(`7 октября ${year + 1} г.`);
  });
});
