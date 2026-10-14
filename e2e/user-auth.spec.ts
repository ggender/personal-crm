import { expect, type Page, test } from "@playwright/test";

import {
  addContact,
  header,
  latestLink,
  requestLink,
  signIn,
  submitLoginForm,
  uniqueEmail,
} from "./helpers/auth";
import {
  ageLoginLinks,
  ageOldestLoginEmail,
  ageSessions,
  closeDb,
  countLoginEmails,
  countSessions,
  makeContact,
  makeGroup,
  makeUser,
  resetDb,
  sessionDaysLeft,
  setSessionAge,
  usersWithEmail,
} from "./helpers/db";
import {
  loginLinkIn,
  loginLinksTo,
  MAILPIT_PAGE_URL,
  messagesTo,
  totalMessages,
} from "./helpers/mailpit";

/*
 * openspec/specs/user-auth/spec.md in a real browser. Every test is one scenario of the spec and
 * is named like it. The emails are real: they are read from Mailpit. Waiting for minutes or days
 * is replaced by moving the dates in the database (see helpers/db.ts).
 * The scenario "Почтовый сервис недоступен" is in tests/user-auth.test.ts (Vitest).
 */

test.beforeEach(resetDb);
test.afterAll(closeDb);

const EXPIRED = "Ссылка устарела, запросите новую";
const TOO_OFTEN = "Слишком часто, попробуйте через несколько минут";

const sentTo = (email: string) => `Ссылка для входа отправлена на ${email}`;
const loginForm = (page: Page) => page.getByRole("button", { name: "Получить ссылку" });
const logout = (page: Page) => page.getByRole("button", { name: "Выйти" });

/** A second browser: its own cookies and storage. */
async function otherBrowser(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

async function expectLoginPage(page: Page) {
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Вход", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Почта")).toBeVisible();
  await expect(loginForm(page)).toBeVisible();
}

async function expectContactsPage(page: Page) {
  await expect(page.getByRole("heading", { name: "Контакты", level: 1 })).toBeVisible();
}

test.describe("Без входа приложение не открывается", () => {
  test("Открыл приложение без входа", async ({ page }) => {
    const owner = await makeUser(uniqueEmail("anna"));
    await makeContact({ userId: owner, name: "Вера Кузнецова" });

    await page.goto("/");

    await expectLoginPage(page);
    await expect(page.getByText("Вера Кузнецова")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Контакты" })).toHaveCount(0);
  });

  test("Прямая ссылка без входа", async ({ page }) => {
    const owner = await makeUser(uniqueEmail("anna"));
    const id = await makeContact({ userId: owner, name: "Вера Кузнецова" });
    await makeGroup(owner, "Теннис");

    await page.goto(`/contacts/${id}`);
    await expectLoginPage(page);
    await expect(page.getByText("Вера Кузнецова")).toHaveCount(0);

    await page.goto("/groups");
    await expectLoginPage(page);
    await expect(page.getByText("Теннис")).toHaveCount(0);
  });

  test("Проверка /health без входа", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(Object.keys(body).sort()).toEqual(["status", "version"]);
  });
});

test.describe("Запрос ссылки для входа", () => {
  test("Ссылка отправлена", async ({ page }) => {
    const email = uniqueEmail("anna");

    await submitLoginForm(page, email);

    await expect(page.getByRole("status")).toHaveText(sentTo(email));
    expect(await messagesTo(email)).toHaveLength(1);
  });

  test("Пробелы и большие буквы", async ({ page, browser }) => {
    const email = uniqueEmail("anna");
    const typed = `  ${email.replace("anna", "Anna").replace("example.test", "Example.TEST")}  `;

    await submitLoginForm(page, typed);

    await expect(page.getByRole("status")).toHaveText(sentTo(email));
    expect(await messagesTo(email)).toHaveLength(1);

    // The link opens the same person as a login as "anna@example.test" does.
    await page.goto(await latestLink(email));
    await expect(header(page).getByText(email)).toBeVisible();
    await addContact(page, "Вера Кузнецова");

    const second = await otherBrowser(browser);
    try {
      await signIn(second.page, email);
      await expect(
        second.page.getByRole("main").getByRole("link", { name: "Вера Кузнецова" }),
      ).toBeVisible();
    } finally {
      await second.context.close();
    }
    expect(await usersWithEmail(email)).toHaveLength(1);
  });
});

test.describe("Неверный адрес почты", () => {
  test("Неверный адрес в форме", async ({ page }) => {
    const before = await totalMessages();

    for (const typed of ["", "anna@"]) {
      await submitLoginForm(page, typed);
      await expect(page.getByText("Проверьте адрес почты")).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
    }

    expect(await totalMessages()).toBe(before);
  });

  test("Неверный адрес в обход формы", async ({ request }) => {
    const before = await totalMessages();

    const response = await request.post("/api/auth/sign-in/magic-link", {
      data: { email: "anna@" },
    });

    expect(response.ok()).toBe(false);
    expect(response.status()).toBe(400);
    expect(await totalMessages()).toBe(before);
  });
});

test.describe("Ответ не выдаёт, есть ли пользователь", () => {
  test("Старая и новая почта", async ({ page, browser }) => {
    const anna = uniqueEmail("anna");
    const boris = uniqueEmail("boris");
    // anna has signed in before, boris never.
    await signIn(page, anna);
    await logout(page).click();
    await expect(page).toHaveURL(/\/login$/);

    const answer = async (p: Page, email: string) => {
      await requestLink(p, email);
      return (await p.locator("body").innerText()).replaceAll(email, "<email>");
    };
    const forAnna = await answer(page, anna);
    const second = await otherBrowser(browser);
    try {
      const forBoris = await answer(second.page, boris);
      expect(forBoris).toBe(forAnna);
      expect(forBoris).toContain("Ссылка для входа отправлена на <email>");
    } finally {
      await second.context.close();
    }
  });
});

test.describe("Первый вход — это регистрация", () => {
  test("Первый вход", async ({ page }) => {
    const email = uniqueEmail("anna");

    await requestLink(page, email);
    // No registration form and no question about the name on the way.
    await expect(page.getByLabel("Имя")).toHaveCount(0);
    await page.goto(await latestLink(email));

    await expect(page).toHaveURL(/\/$/);
    await expectContactsPage(page);
    await expect(page.getByText("Пока нет ни одного контакта")).toBeVisible();
    const users = await usersWithEmail(email);
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("");
  });

  test("Повторный вход", async ({ page }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);
    await addContact(page, "Вера Кузнецова");
    await logout(page).click();
    await expect(page).toHaveURL(/\/login$/);

    await signIn(page, email);

    await expect(
      page.getByRole("main").getByRole("link", { name: "Вера Кузнецова" }),
    ).toBeVisible();
    expect(await usersWithEmail(email)).toHaveLength(1);
  });
});

test.describe("Ссылка открывает приложение", () => {
  test("Вход по ссылке", async ({ page }) => {
    const email = uniqueEmail("anna");
    await requestLink(page, email);

    await page.goto(await latestLink(email));

    await expect(page).toHaveURL(/\/$/);
    await expectContactsPage(page);
    await expect(header(page).getByText(email)).toBeVisible();
    await expect(logout(page)).toBeVisible();
  });
});

test.describe("Ссылка работает один раз и 15 минут", () => {
  test("Ссылка второй раз", async ({ page, browser }) => {
    const email = uniqueEmail("anna");
    await requestLink(page, email);
    const link = await latestLink(email);
    await page.goto(link);
    await expectContactsPage(page);

    const other = await otherBrowser(browser);
    try {
      await other.page.goto(link);
      await expect(other.page.getByText(EXPIRED)).toBeVisible();

      await other.page.goto("/");
      await expectLoginPage(other.page);
    } finally {
      await other.context.close();
    }
  });

  test("Ссылка старше 15 минут", async ({ page }) => {
    const email = uniqueEmail("anna");
    await requestLink(page, email);
    const link = await latestLink(email);

    // 16 minutes after the email came: the link had 15.
    await ageLoginLinks(email, 16);
    await page.goto(link);

    await expect(page.getByText(EXPIRED)).toBeVisible();
    await page.goto("/");
    await expectLoginPage(page);
  });

  test("Новая ссылка отменяет старую", async ({ page }) => {
    const email = uniqueEmail("anna");
    await requestLink(page, email);
    await requestLink(page, email);
    const [second, first] = await loginLinksTo(email);

    await page.goto(first);
    await expect(page.getByText(EXPIRED)).toBeVisible();

    await page.goto(second);
    await expectContactsPage(page);
    await expect(header(page).getByText(email)).toBeVisible();
  });

  test("Кнопка на страницу входа", async ({ page }) => {
    await page.goto("/login/expired");
    await expect(page.getByText(EXPIRED)).toBeVisible();

    await page.getByRole("link", { name: "На страницу входа" }).click();

    await expectLoginPage(page);
  });
});

test.describe("Не больше 3 писем на одну почту за 10 минут", () => {
  async function askThreeTimes(page: Page, email: string) {
    for (let i = 0; i < 3; i++) await requestLink(page, email);
  }

  test("Четвёртый запрос", async ({ page }) => {
    const email = uniqueEmail("anna");
    await askThreeTimes(page, email);

    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByText(TOO_OFTEN)).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    const messages = await messagesTo(email);
    expect(messages).toHaveLength(3);
    // The link of the third email still logs in.
    await page.goto(loginLinkIn(messages[0]));
    await expect(header(page).getByText(email)).toBeVisible();
  });

  test("Через 10 минут снова можно", async ({ page }) => {
    const email = uniqueEmail("anna");
    await askThreeTimes(page, email);
    await page.getByRole("button", { name: "Получить ссылку" }).click();
    await expect(page.getByText(TOO_OFTEN)).toBeVisible();

    // The first of the three emails is now 11 minutes old.
    await ageOldestLoginEmail(email, 11);
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByRole("status")).toHaveText(sentTo(email));
    expect(await messagesTo(email)).toHaveLength(4);
  });

  test("Лимит у каждой почты свой", async ({ page }) => {
    const anna = uniqueEmail("anna");
    const boris = uniqueEmail("boris");
    await askThreeTimes(page, anna);
    await page.getByRole("button", { name: "Получить ссылку" }).click();
    await expect(page.getByText(TOO_OFTEN)).toBeVisible();

    await requestLink(page, boris);

    expect(await messagesTo(boris)).toHaveLength(1);
    expect(await countLoginEmails(anna)).toBe(3);
  });
});

test.describe("Вход держится 30 дней с последнего захода", () => {
  test("Браузер закрыли и открыли снова", async ({ page, browser, context }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);

    // Closing the browser drops the cookies without an end date (session cookies) and no others.
    const kept = (await context.cookies()).filter((cookie) => cookie.expires > 0);
    expect(kept.some((cookie) => cookie.name.includes("session_token"))).toBe(true);
    await context.close();

    const reopened = await browser.newContext({ storageState: { cookies: kept, origins: [] } });
    try {
      const again = await reopened.newPage();
      await again.goto("/");
      await expectContactsPage(again);
      await expect(header(again).getByText(email)).toBeVisible();
    } finally {
      await reopened.close();
    }
  });

  test("Не заходил больше 30 дней", async ({ page }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);

    // The last visit was 31 days ago, so the login ended yesterday.
    await setSessionAge(email, { daysLeft: -1, lastVisitDaysAgo: 31 });
    await page.goto("/");

    await expectLoginPage(page);
  });

  test("Заход продлевает срок", async ({ page, context }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);

    // The last visit was 20 days ago: 10 days of the login are left.
    await setSessionAge(email, { daysLeft: 10, lastVisitDaysAgo: 20 });
    await page.goto("/");
    await expectContactsPage(page);

    // The visit renews the login to 30 days, in the database and in the cookie.
    await expect.poll(() => sessionDaysLeft(email), { timeout: 10_000 }).toBeGreaterThan(29);
    await expect
      .poll(async () => {
        const cookie = (await context.cookies()).find((c) => c.name.includes("session_token"));
        return ((cookie?.expires ?? 0) - Date.now() / 1000) / 86400;
      })
      .toBeGreaterThan(29);

    // 25 days later (the dates move back by 25 days): still logged in, 5 days left.
    await ageSessions(email, 25);
    await page.goto("/");
    await expectContactsPage(page);
    await expect(header(page).getByText(email)).toBeVisible();
  });

  test("Несколько устройств сразу", async ({ page, browser }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);

    const other = await otherBrowser(browser);
    try {
      await signIn(other.page, email);

      await page.goto("/");
      await expectContactsPage(page);
      await expectContactsPage(other.page);
      expect(await countSessions(email)).toBe(2);
    } finally {
      await other.context.close();
    }
  });
});

test.describe("Почта и «Выйти» в шапке", () => {
  test("Почта в шапке", async ({ page }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);
    await addContact(page, "Вера Кузнецова");

    const contactUrl = await page
      .getByRole("main")
      .getByRole("link", { name: "Вера Кузнецова" })
      .getAttribute("href");
    for (const url of ["/", contactUrl!, "/groups"]) {
      await page.goto(url);
      await expect(header(page).getByText(email)).toBeVisible();
      await expect(logout(page)).toBeVisible();
    }
  });

  test("Выход", async ({ page }) => {
    await signIn(page, uniqueEmail("anna"));

    await logout(page).click();

    await expectLoginPage(page);
    await page.goto("/");
    await expectLoginPage(page);
  });

  test("Выход только на этом устройстве", async ({ page, browser }) => {
    const email = uniqueEmail("anna");
    await signIn(page, email);
    await addContact(page, "Вера Кузнецова");
    const other = await otherBrowser(browser);
    try {
      await signIn(other.page, email);

      await logout(page).click();
      await expectLoginPage(page);

      await other.page.goto("/");
      await expectContactsPage(other.page);
      await expect(
        other.page.getByRole("main").getByRole("link", { name: "Вера Кузнецова" }),
      ).toBeVisible();
    } finally {
      await other.context.close();
    }
  });
});

test.describe("Письмо для входа", () => {
  test("Как выглядит письмо", async ({ page }) => {
    const email = uniqueEmail("anna");
    await requestLink(page, email);
    const [message] = await messagesTo(email);

    expect(message.from).toEqual({ name: "Личная CRM", address: "noreply@mail.crm.vprodcrm.ru" });
    expect(message.subject).toBe("Вход в Личную CRM");
    for (const part of [message.html, message.text]) {
      expect(part).toContain("Ссылка работает 15 минут");
      expect(part).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
    }
    // The button "Войти" is a link, and it is the same link as in the text version.
    const button = /<a [^>]*href="([^"]+)"[^>]*>\s*Войти\s*<\/a>/.exec(message.html);
    expect(button, "button «Войти» in the HTML").not.toBeNull();
    const href = button![1].replaceAll("&amp;", "&");
    expect(href).toBe(loginLinkIn(message));

    await page.goto(href);
    await expect(header(page).getByText(email)).toBeVisible();
  });
});

test.describe("Письма на компьютере и в автотестах не уходят наружу", () => {
  test("Письмо в почтовой заглушке", async ({ page }) => {
    const email = uniqueEmail("test");
    await requestLink(page, email);
    const [message] = await messagesTo(email);

    // The email is on the page of Mailpit...
    await page.goto(`${MAILPIT_PAGE_URL}/search?q=${encodeURIComponent(`to:"${email}"`)}`);
    await expect(page.getByText("Вход в Личную CRM").first()).toBeVisible();

    // ...and the link from it logs in.
    await page.goto(loginLinkIn(message));
    await expect(header(page).getByText(email)).toBeVisible();
  });
});
