import { expect, type Page, test } from "@playwright/test";

import { closeDb, makeContacts, resetDb } from "./helpers/db";

/*
 * The main scenario from specs/01-продуктовая-идея.md:
 * open → see all contacts; add a contact → find it by name → add a note → the note is saved
 * in the contact's card; the same address in another browser shows the same contacts.
 */

const EXISTING = ["Анна Смирнова", "Борис Орлов"];
const NEW_NAME = "Вера Кузнецова";
const NOTE = "Договорились созвониться в пятницу и обсудить поездку";

test.beforeEach(async () => {
  await resetDb();
  await makeContacts(EXISTING);
});

test.afterAll(closeDb);

function contactLink(page: Page, name: string) {
  return page.getByRole("main").getByRole("link", { name });
}

test("open, add, find, write a note, see the same data in another browser", async ({
  page,
  browser,
}) => {
  // 1. Open: all contacts are listed.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Контакты", level: 1 })).toBeVisible();
  await expect(page.getByText("2 контакта")).toBeVisible();
  for (const name of EXISTING) await expect(contactLink(page, name)).toBeVisible();

  // 2. Add a contact: it appears in the list.
  await page.getByRole("link", { name: "Добавить контакт" }).click();
  await page.getByLabel("Имя *").fill(NEW_NAME);
  await page.getByLabel("Кто это").fill("Соседка по даче");
  await page.getByRole("button", { name: "Сохранить контакт" }).click();

  await expect(page.getByRole("status")).toContainText(`Контакт ${NEW_NAME} добавлен`);
  await expect(page.getByText("3 контакта")).toBeVisible();
  for (const name of [...EXISTING, NEW_NAME]) await expect(contactLink(page, name)).toBeVisible();

  // 3. Find the contact by name: only that person is left in the list.
  await page.getByRole("searchbox", { name: "Найти контакт по имени" }).fill("кузнецова");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.getByText("Найдено 1 из 3")).toBeVisible();
  await expect(contactLink(page, NEW_NAME)).toBeVisible();
  for (const name of EXISTING) await expect(contactLink(page, name)).toBeHidden();

  // 4. Open the card and add a note after the conversation.
  await contactLink(page, NEW_NAME).click();
  await expect(page.getByRole("heading", { name: NEW_NAME, level: 1 })).toBeVisible();
  await page.getByRole("textbox", { name: "Новая заметка" }).fill(NOTE);
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Заметка сохранена")).toBeVisible();

  // The note stays in the card after the page is loaded again.
  const cardUrl = page.url();
  await page.reload();
  await expectNoteInCard(page, NEW_NAME);

  // 5. Another browser (its own cookies and storage) at the same address: the same data.
  const otherBrowser = await browser.newContext();
  try {
    const other = await otherBrowser.newPage();
    await other.goto("/");
    await expect(other.getByText("3 контакта")).toBeVisible();
    for (const name of [...EXISTING, NEW_NAME])
      await expect(contactLink(other, name)).toBeVisible();

    await other.goto(cardUrl);
    await expectNoteInCard(other, NEW_NAME);
  } finally {
    await otherBrowser.close();
  }
});

async function expectNoteInCard(page: Page, name: string) {
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  const notes = page.getByRole("region", { name: "Заметки" }).getByRole("listitem");
  await expect(notes).toHaveCount(1);
  await expect(notes.first()).toContainText(NOTE);
}
