import { expect, type Page } from "@playwright/test";

import { userIdOf } from "./db";
import { loginLinksTo } from "./mailpit";

let counter = 0;

/** A new address for one test: unique, lower case, on a domain that never receives real mail. */
export function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}@example.test`;
}

/** Fills the form on the login page and presses "Получить ссылку". Does not wait for the answer. */
export async function submitLoginForm(page: Page, typed: string) {
  await page.goto("/login");
  await page.getByLabel("Почта").fill(typed);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
}

/** Asks for a login link and waits until the page says it was sent. */
export async function requestLink(page: Page, email: string) {
  await submitLoginForm(page, email);
  await expect(page.getByRole("status")).toHaveText(`Ссылка для входа отправлена на ${email}`);
}

/** The newest login link sent to this address. */
export async function latestLink(email: string) {
  const [link] = await loginLinksTo(email);
  if (!link) throw new Error(`No login email for ${email}`);
  return link;
}

/** Logs in as `email` through the login page and the link from the email, like a person does. */
export async function signIn(page: Page, email: string) {
  await requestLink(page, email);
  await page.goto(await latestLink(email));
  await expect(page.getByRole("banner").getByText(email)).toBeVisible();
}

/** Logs in as a new person and gives his email and his id in the database. */
export async function signInNewUser(page: Page, prefix = "user") {
  const email = uniqueEmail(prefix);
  await signIn(page, email);
  return { email, userId: await userIdOf(email) };
}

/** The header of the app: where the email of the person and "Выйти" are. */
export const header = (page: Page) => page.getByRole("banner");

/** Adds a contact through the form, as a person does. */
export async function addContact(page: Page, name: string) {
  await page.goto("/contacts/new");
  await page.getByLabel("Имя *").fill(name);
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page.getByRole("status")).toContainText(`Контакт ${name} добавлен`);
}
