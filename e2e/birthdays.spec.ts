import { expect, type Page, test } from "@playwright/test";

import { addDays, daysAgo, moscowToday } from "../tests/helpers/days";
import { signInNewUser } from "./helpers/auth";
import { addMember, closeDb, makeContact, makeGroup, resetDb } from "./helpers/db";

/*
 * Main paths of openspec/changes/birthdays/specs/birthdays/spec.md in a real browser: the date of
 * birth in the forms and on the contact page, and the block "Скоро день рождения" on the home page.
 * The rules (age, 29 February, New Year, the checks) are covered by tests/birthdays.test.ts with a
 * chosen "today"; the dates here are counted from the real today.
 */

test.beforeEach(resetDb);
test.afterAll(closeDb);

const dayField = (page: Page) => page.getByLabel("День", { exact: true });
const monthField = (page: Page) => page.getByLabel("Месяц", { exact: true });
const yearField = (page: Page) => page.getByLabel("Год", { exact: true });

/** The row "Дата рождения" of the contact page. */
const birthRow = (page: Page) =>
  page.locator("dl > div").filter({ has: page.getByText("Дата рождения", { exact: true }) });

/** The month and the day of a day like "2026-10-15" as numbers. */
function monthAndDay(day: string) {
  const [, month, dayOfMonth] = day.split("-").map(Number);
  return { month, day: dayOfMonth };
}

test.describe("Дата рождения в формах контакта", () => {
  test("Контакт с полной датой рождения", async ({ page }) => {
    await signInNewUser(page, "owner");

    await page.goto("/contacts/new");
    await page.getByLabel("Имя *").fill("Анна Смирнова");
    await dayField(page).selectOption("18");
    await monthField(page).selectOption({ label: "октября" });
    await yearField(page).fill("1990");
    await page.getByRole("button", { name: "Сохранить контакт" }).click();

    await expect(page.getByRole("status")).toContainText("Контакт Анна Смирнова добавлен");
    await page.getByRole("link", { name: "Открыть" }).click();
    await expect(page.getByRole("heading", { name: "Анна Смирнова", level: 1 })).toBeVisible();
    await expect(birthRow(page)).toContainText("18 октября 1990");

    await page.getByRole("link", { name: "Изменить" }).click();
    await expect(dayField(page)).toHaveValue("18");
    await expect(monthField(page).locator("option:checked")).toHaveText("октября");
    await expect(yearField(page)).toHaveValue("1990");
  });

  test("Указан только день", async ({ page }) => {
    await signInNewUser(page, "owner");

    await page.goto("/contacts/new");
    await page.getByLabel("Имя *").fill("Анна Смирнова");
    await dayField(page).selectOption("18");
    await page.getByRole("button", { name: "Сохранить контакт" }).click();

    await expect(page.getByText("Укажите день и месяц")).toBeVisible();
    // Nothing was saved, and what was chosen stays in the form.
    await expect(page).toHaveURL(/\/contacts\/new/);
    await expect(dayField(page)).toHaveValue("18");
    await expect(page.getByLabel("Имя *")).toHaveValue("Анна Смирнова");
  });

  test("Удаление даты рождения", async ({ page }) => {
    const { userId } = await signInNewUser(page, "owner");
    const id = await makeContact({
      userId,
      name: "Анна Смирнова",
      birth: { ...monthAndDay(addDays(moscowToday(), 1)), year: 1990 },
    });

    await page.goto(`/contacts/${id}`);
    await expect(birthRow(page)).toBeVisible();

    await page.goto(`/contacts/${id}/edit`);
    await dayField(page).selectOption({ value: "" });
    await monthField(page).selectOption({ value: "" });
    await yearField(page).fill("");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();

    await expect(page.getByRole("heading", { name: "Анна Смирнова", level: 1 })).toBeVisible();
    await expect(birthRow(page)).toHaveCount(0);
  });
});

const birthdayBlock = (page: Page) => page.getByRole("region", { name: /Скоро день рождения/ });
const keepInTouchBlock = (page: Page) => page.getByRole("region", { name: /Пора связаться/ });

/** The month and the day `days` days from today, for a contact whose birthday is then. */
const birthIn = (days: number, year?: number) => ({
  ...monthAndDay(addDays(moscowToday(), days)),
  year,
});

test.describe("Блок «Скоро день рождения» на главной", () => {
  test("Переход в карточку из блока", async ({ page }) => {
    const { userId } = await signInNewUser(page, "owner");
    await makeContact({ userId, name: "Анна Смирнова", birth: birthIn(1, 1990) });

    await page.goto("/");
    await birthdayBlock(page).getByRole("link", { name: "Анна Смирнова" }).click();

    await expect(page.getByRole("heading", { name: "Анна Смирнова", level: 1 })).toBeVisible();
  });

  test("Блок выше «Пора связаться»", async ({ page }) => {
    const { userId } = await signInNewUser(page, "owner");
    await makeContact({ userId, name: "Анна Смирнова", birth: birthIn(0, 1990) });
    await makeContact({
      userId,
      name: "Борис Орлов",
      frequency: "weekly",
      createdAt: daysAgo(30),
    });

    await page.goto("/");

    await expect(birthdayBlock(page)).toContainText("Скоро день рождения · 1");
    await expect(keepInTouchBlock(page)).toBeVisible();
    const birthdayTop = (await birthdayBlock(page).boundingBox())!.y;
    const keepInTouchTop = (await keepInTouchBlock(page).boundingBox())!.y;
    expect(birthdayTop).toBeLessThan(keepInTouchTop);
  });

  test("Выбрана другая группа", async ({ page }) => {
    const { userId } = await signInNewUser(page, "owner");
    const tennis = await makeGroup(userId, "Теннис");
    await addMember(tennis, await makeContact({ userId, name: "Борис Орлов" }));
    await makeContact({ userId, name: "Анна Смирнова", birth: birthIn(1) });

    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Фильтр по группам" })
      .getByRole("link", { name: "Теннис" })
      .click();

    await expect(page).toHaveURL(/group=/);
    await expect(birthdayBlock(page)).toContainText("Анна Смирнова");
  });

  test("Во время поиска блок скрыт", async ({ page }) => {
    const { userId } = await signInNewUser(page, "owner");
    await makeContact({ userId, name: "Анна Смирнова", birth: birthIn(1) });

    await page.goto("/");
    await expect(birthdayBlock(page)).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Найти контакт по имени" });
    await search.fill("смирнова");
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(page.getByText("Найдено 1 из 1")).toBeVisible();
    await expect(birthdayBlock(page)).toHaveCount(0);

    await search.fill("");
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(birthdayBlock(page)).toBeVisible();
  });
});
