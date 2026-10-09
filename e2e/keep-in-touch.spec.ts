import { expect, type Page, test } from "@playwright/test";

import {
  addDays,
  addMonths,
  daysAgo,
  daysBetween,
  moscowDay,
  moscowToday,
  ruDay,
} from "../tests/helpers/days";
import { closeDb, makeContact, makeNote, resetDb } from "./helpers/db";

/*
 * Main paths of openspec/specs/keep-in-touch/spec.md in a real browser: frequency and
 * "Пообщались" on the contact page, the "Пора связаться" block on the home page, and the block
 * going away once the last overdue contact is marked. The calculation details are covered by
 * tests/keep-in-touch.test.ts.
 */

// "Отменить" stays for 5 seconds; then the row leaves the block.
const AFTER_UNDO_WINDOW = { timeout: 10_000 };

test.beforeEach(resetDb);
test.afterAll(closeDb);

/** A contact whose only note was written `days` days ago. */
async function contactWithNote(
  name: string,
  frequency: Parameters<typeof makeContact>[0]["frequency"],
  days: number,
) {
  const id = await makeContact({ name, frequency, createdAt: daysAgo(days) });
  await makeNote(id, daysAgo(days));
  return id;
}

const pluralRules = new Intl.PluralRules("ru-RU");
function overdue(days: number) {
  const form = pluralRules.select(days);
  return `просрочено на ${days} ${form === "one" ? "день" : form === "few" ? "дня" : "дней"}`;
}

/** Days past the due date for a note written `days` days ago and a period of `months` months. */
const overdueAfterMonths = (days: number, months: number) =>
  daysBetween(addMonths(moscowDay(daysAgo(days)), months), moscowToday());

const frequency = (page: Page, label: string) => page.getByRole("radio", { name: label });
// The radio itself is visually hidden; the owner taps its pill, the label around it.
const pickFrequency = (page: Page, label: string) =>
  page.locator("label", { has: frequency(page, label) }).click();
const markButton = (page: Page) => page.getByRole("button", { name: "Пообщались" });
const undoButton = (page: Page) => page.getByRole("button", { name: "Отменить" });
const touchStatus = (page: Page) => page.getByText(/Связаться не позже|Пора связаться:/);
const keepInTouch = (page: Page) => page.getByRole("region", { name: /Пора связаться/ });
const blockRow = (page: Page, name: string) =>
  keepInTouch(page).getByRole("listitem").filter({ hasText: name });

test("set a frequency and mark a conversation on the contact page", async ({ page, browser }) => {
  const id = await contactWithNote("Анна Смирнова", null, 10);
  const inAWeek = `Связаться не позже ${ruDay(addDays(moscowToday(), 7))}`;
  const overdueBy3 = `Пора связаться: ${overdue(3)}`;

  // A contact without a frequency: no due date, no "Пообщались".
  await page.goto(`/contacts/${id}`);
  await expect(frequency(page, "Не задано")).toBeChecked();
  await expect(touchStatus(page)).toHaveCount(0);
  await expect(markButton(page)).toHaveCount(0);

  // "Раз в неделю" with the last note 10 days ago: overdue by 3 days.
  await pickFrequency(page, "Раз в неделю");
  await expect(page.getByText(overdueBy3)).toBeVisible();
  await expect(markButton(page)).toBeVisible();

  // The choice is saved: after a reload and in another browser.
  await page.reload();
  await expect(frequency(page, "Раз в неделю")).toBeChecked();
  const otherBrowser = await browser.newContext();
  try {
    const other = await otherBrowser.newPage();
    await other.goto(`/contacts/${id}`);
    await expect(frequency(other, "Раз в неделю")).toBeChecked();
    await expect(other.getByText(overdueBy3)).toBeVisible();
  } finally {
    await otherBrowser.close();
  }

  // "Пообщались": the due date starts from today, "Отменить" brings the old one back.
  await markButton(page).click();
  await expect(page.getByText(inAWeek)).toBeVisible();
  await expect(page.getByText("Отмечено", { exact: true }).first()).toBeVisible();
  await undoButton(page).click();
  await expect(page.getByText(overdueBy3)).toBeVisible();
  await expect(markButton(page)).toBeVisible();

  // Without undo the mark stays once "Отменить" is gone, and no note is added.
  await markButton(page).click();
  await expect(page.getByText(inAWeek)).toBeVisible();
  await expect(undoButton(page)).toBeHidden(AFTER_UNDO_WINDOW);
  await expect(markButton(page)).toBeVisible();
  await page.reload();
  await expect(page.getByText(inAWeek)).toBeVisible();
  await expect(page.getByRole("region", { name: "Заметки" }).getByRole("listitem")).toHaveCount(1);

  // Back to "Не задано": no due date and no button again.
  await pickFrequency(page, "Не задано");
  await expect(touchStatus(page)).toHaveCount(0);
  await expect(markButton(page)).toHaveCount(0);
});

test("work through the «Пора связаться» block on the home page", async ({ page }) => {
  await contactWithNote("Анна Смирнова", "monthly", 42);
  await contactWithNote("Борис Орлов", "weekly", 10);
  await contactWithNote("Вера Кузнецова", "yearly", 400);
  await contactWithNote("Глеб Ершов", null, 400);
  await contactWithNote("Дарья Ли", "weekly", 2);

  // Three overdue contacts, the most overdue first; no frequency or not due yet — not in the block.
  await page.goto("/");
  const block = keepInTouch(page);
  await expect(block.getByRole("heading", { name: "Пора связаться · 3" })).toBeVisible();
  const rows = block.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  const expected = [
    ["Вера Кузнецова", `Раз в год · ${overdue(overdueAfterMonths(400, 12))}`],
    ["Анна Смирнова", `Раз в месяц · ${overdue(overdueAfterMonths(42, 1))}`],
    ["Борис Орлов", `Раз в неделю · ${overdue(3)}`],
  ];
  for (const [index, [name, line]] of expected.entries()) {
    await expect(rows.nth(index).getByRole("link", { name })).toBeVisible();
    await expect(rows.nth(index).getByText(line)).toBeVisible();
    await expect(rows.nth(index).getByRole("button", { name: "Пообщались" })).toBeVisible();
  }
  // An overdue contact is still in the list under its letter.
  await expect(
    page.getByRole("region", { name: "На букву Б" }).getByRole("link", { name: "Борис Орлов" }),
  ).toBeVisible();

  // While searching there is no block; it comes back once the search is cleared.
  const search = page.getByRole("searchbox", { name: "Найти контакт по имени" });
  await search.fill("борис");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(block).toBeHidden();
  await search.fill("");
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(block).toBeVisible();

  // "Пообщались" in a row: still on the home page, "Отмечено"; "Отменить" puts the row back.
  const boris = blockRow(page, "Борис Орлов");
  await boris.getByRole("button", { name: "Пообщались" }).click();
  await expect(boris.getByText("Отмечено", { exact: true }).first()).toBeVisible();
  await expect(boris.getByRole("button", { name: "Отменить" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await boris.getByRole("button", { name: "Отменить" }).click();
  await expect(boris.getByText(`Раз в неделю · ${overdue(3)}`)).toBeVisible();
  await expect(boris.getByRole("button", { name: "Пообщались" })).toBeVisible();
  await page.reload();
  await expect(boris.getByText(`Раз в неделю · ${overdue(3)}`)).toBeVisible();

  // Without undo the row leaves the block a few seconds later.
  await boris.getByRole("button", { name: "Пообщались" }).click();
  await expect(block.getByRole("heading", { name: "Пора связаться · 2" })).toBeVisible(
    AFTER_UNDO_WINDOW,
  );
  await expect(boris).toHaveCount(0);

  // The name opens the contact page; a new note there takes the contact out of the block.
  await block.getByRole("link", { name: "Анна Смирнова" }).click();
  await expect(page.getByRole("heading", { name: "Анна Смирнова", level: 1 })).toBeVisible();
  await page.getByRole("textbox", { name: "Новая заметка" }).fill("Встретились за кофе");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Заметка сохранена")).toBeVisible();
  await page.goto("/");
  await expect(block.getByRole("heading", { name: "Пора связаться · 1" })).toBeVisible();
  await expect(blockRow(page, "Анна Смирнова")).toHaveCount(0);
});

test("the block goes away once the last overdue contact is marked", async ({ page }) => {
  await contactWithNote("Борис Орлов", "weekly", 10);
  await makeContact({ name: "Анна Смирнова" });

  await page.goto("/");
  await blockRow(page, "Борис Орлов").getByRole("button", { name: "Пообщались" }).click();

  await expect(keepInTouch(page)).toBeHidden(AFTER_UNDO_WINDOW);
  const list = page.getByRole("main");
  await expect(list.getByRole("link", { name: "Анна Смирнова" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Борис Орлов" })).toBeVisible();
});
