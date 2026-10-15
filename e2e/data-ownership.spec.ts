import { expect, type Page, test } from "@playwright/test";

import { addDays, daysAgo, moscowToday } from "../tests/helpers/days";
import { addContact, signInNewUser } from "./helpers/auth";
import {
  addMember,
  closeDb,
  makeContact,
  makeContacts,
  makeGroup,
  makeNote,
  resetDb,
} from "./helpers/db";

/*
 * openspec/specs/data-ownership/spec.md in a real browser: two people, A and B, in two browsers
 * (own cookies each). The success criterion of the spec: A adds a contact, B has it neither in the
 * list, nor in the search, nor by the direct link. Every test is one scenario, named like it.
 * What only a request to the server can show is in tests/data-ownership.test.ts; the migration
 * that gives the old data to the owner is in tests/data-owner-migration.test.ts.
 */

test.beforeEach(resetDb);
test.afterAll(closeDb);

/** A second person in a browser of his own. */
async function personB(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = await signInNewUser(page, "boris");
  return { ...user, page, close: () => context.close() };
}

const list = (page: Page) => page.getByRole("main");
const contactLink = (page: Page, name: string) => list(page).getByRole("link", { name });
const overdueBlock = (page: Page) => page.getByRole("region", { name: /Пора связаться/ });
const birthdayBlock = (page: Page) => page.getByRole("region", { name: /Скоро день рождения/ });
const tomorrow = () => {
  const [, month, day] = addDays(moscowToday(), 1).split("-").map(Number);
  return { day, month, year: 1990 };
};
const groupFilter = (page: Page) => page.getByRole("navigation", { name: "Фильтр по группам" });

/** A has a contact with a phone and a note, a group with him in it, and a person long overdue. */
async function userAWithData(page: Page) {
  const a = await signInNewUser(page, "anna");
  const vera = await makeContact({ userId: a.userId, name: "Вера Кузнецова" });
  await makeNote(vera, daysAgo(2), "Договорились созвониться");
  const tennis = await makeGroup(a.userId, "Теннис");
  await addMember(tennis, vera);
  const overdue = await makeContact({
    userId: a.userId,
    name: "Глеб Ершов",
    frequency: "weekly",
    createdAt: daysAgo(30),
  });
  return { ...a, vera, tennis, overdue };
}

test.describe("У каждой записи есть владелец", () => {
  test("Новый контакт у того, кто его добавил", async ({ page, browser }) => {
    await signInNewUser(page, "anna");

    await page.goto("/contacts/new");
    await page.getByLabel("Имя *").fill("Вера Кузнецова");
    await page.getByLabel("О чём договорились").fill("Договорились созвониться");
    await page.getByRole("button", { name: "Сохранить контакт" }).click();
    await expect(page.getByRole("status")).toContainText("Контакт Вера Кузнецова добавлен");
    await contactLink(page, "Вера Кузнецова").click();
    await expect(page.getByText("Договорились созвониться")).toBeVisible();

    const b = await personB(browser);
    try {
      await expect(contactLink(b.page, "Вера Кузнецова")).toHaveCount(0);
    } finally {
      await b.close();
    }
  });
});

test.describe("Пользователь видит только своё", () => {
  test("Чужого контакта нет в списке и поиске", async ({ page, browser }) => {
    await signInNewUser(page, "anna");
    await addContact(page, "Вера Кузнецова");
    await expect(page.getByText("1 контакт", { exact: true })).toBeVisible();

    const b = await personB(browser);
    try {
      await makeContacts(b.userId, ["Анна Смирнова", "Борис Орлов"]);
      await b.page.goto("/");
      await expect(contactLink(b.page, "Вера Кузнецова")).toHaveCount(0);
      await expect(b.page.getByText("2 контакта", { exact: true })).toBeVisible();

      await b.page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("Кузнецова");
      await expect(b.page.getByText("Никого не нашлось по запросу «Кузнецова»")).toBeVisible();
    } finally {
      await b.close();
    }
  });

  test("Чужие просроченные не попадают в «Пора связаться»", async ({ page, browser }) => {
    await userAWithData(page);
    await page.goto("/");
    await expect(overdueBlock(page)).toContainText("Глеб Ершов");

    const b = await personB(browser);
    try {
      await makeContacts(b.userId, ["Анна Смирнова"]);
      await b.page.goto("/");
      await expect(contactLink(b.page, "Анна Смирнова")).toBeVisible();
      await expect(overdueBlock(b.page)).toHaveCount(0);
    } finally {
      await b.close();
    }
  });

  test("Чужие дни рождения не попадают в «Скоро день рождения»", async ({ page, browser }) => {
    const a = await signInNewUser(page, "anna");
    await makeContact({ userId: a.userId, name: "Вера Кузнецова", birth: tomorrow() });
    await page.goto("/");
    await expect(birthdayBlock(page)).toContainText("Вера Кузнецова");

    const b = await personB(browser);
    try {
      await makeContacts(b.userId, ["Анна Смирнова"]);
      await b.page.goto("/");
      await expect(contactLink(b.page, "Анна Смирнова")).toBeVisible();
      await expect(birthdayBlock(b.page)).toHaveCount(0);
    } finally {
      await b.close();
    }
  });

  test("Чужих групп не видно", async ({ page, browser }) => {
    await userAWithData(page);

    const b = await personB(browser);
    try {
      const own = await makeContact({ userId: b.userId, name: "Анна Смирнова" });
      await b.page.goto("/groups");
      await expect(b.page.getByText("Групп пока нет")).toBeVisible();
      await expect(b.page.getByText("Теннис")).toHaveCount(0);

      await b.page.goto("/");
      await expect(groupFilter(b.page)).toHaveCount(0);
      await expect(b.page.getByText("Теннис")).toHaveCount(0);

      await b.page.goto(`/contacts/${own}`);
      await expect(b.page.getByText("Групп пока нет")).toBeVisible();
      await expect(b.page.getByText("Теннис")).toHaveCount(0);
    } finally {
      await b.close();
    }
  });
});

test.describe("Чужое не открывается по прямой ссылке", () => {
  test("Чужой контакт по прямой ссылке", async ({ page, browser }) => {
    const a = await userAWithData(page);

    const b = await personB(browser);
    try {
      await b.page.goto(`/contacts/${a.vera}`);

      await expect(b.page.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
      await expect(b.page.getByText("Вера Кузнецова")).toHaveCount(0);
      await expect(b.page.getByText("Договорились созвониться")).toHaveCount(0);
      await expect(b.page).toHaveTitle(/Контакт не найден/);
    } finally {
      await b.close();
    }
  });

  test("Правка чужого контакта по прямой ссылке", async ({ page, browser }) => {
    const a = await userAWithData(page);

    const b = await personB(browser);
    try {
      await b.page.goto(`/contacts/${a.vera}/edit`);

      await expect(b.page.getByRole("heading", { name: "Контакт не найден" })).toBeVisible();
      await expect(b.page.getByLabel("Имя *")).toHaveCount(0);
      await expect(b.page.getByText("Вера Кузнецова")).toHaveCount(0);
    } finally {
      await b.close();
    }
  });

  test("Чужая группа в ссылке", async ({ page, browser }) => {
    const a = await userAWithData(page);

    const b = await personB(browser);
    try {
      await makeContacts(b.userId, ["Анна Смирнова", "Борис Орлов"]);
      await b.page.goto(`/?group=${a.tennis}`);

      await expect(contactLink(b.page, "Анна Смирнова")).toBeVisible();
      await expect(contactLink(b.page, "Борис Орлов")).toBeVisible();
      await expect(b.page.getByText("Теннис")).toHaveCount(0);
    } finally {
      await b.close();
    }
  });
});

test.describe("Новый пользователь начинает с пустого", () => {
  test("Первый вход нового пользователя", async ({ page, browser }) => {
    const a = await signInNewUser(page, "anna");
    await makeContacts(
      a.userId,
      Array.from({ length: 50 }, (_, i) => `Контакт ${i + 1}`),
    );
    const tennis = await makeGroup(a.userId, "Теннис");
    const first = await makeContact({
      userId: a.userId,
      name: "Просроченный",
      frequency: "weekly",
      createdAt: daysAgo(30),
    });
    await addMember(tennis, first);
    await makeContact({ userId: a.userId, name: "Именинник", birth: tomorrow() });
    await page.goto("/");
    await expect(page.getByText("52 контакта", { exact: true })).toBeVisible();
    await expect(birthdayBlock(page)).toContainText("Именинник");

    const b = await personB(browser);
    try {
      await b.page.goto("/");
      await expect(b.page.getByText("0 контактов", { exact: true })).toBeVisible();
      await expect(b.page.getByText("Пока нет ни одного контакта")).toBeVisible();
      await expect(b.page.getByRole("link", { name: "Добавить первый контакт" })).toBeVisible();
      await expect(overdueBlock(b.page)).toHaveCount(0);
      await expect(birthdayBlock(b.page)).toHaveCount(0);
      await expect(groupFilter(b.page)).toHaveCount(0);
    } finally {
      await b.close();
    }
  });
});
