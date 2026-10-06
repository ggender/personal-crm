// Fills an empty database with realistic test contacts and notes.
// Refuses to run when contacts already exist, so it never duplicates or overwrites data.
import { fakerRU as faker } from "@faker-js/faker";
import { loadEnvConfig } from "@next/env";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { contacts, notes } from "../src/db/schema";

loadEnvConfig(process.cwd());

const CONTACT_COUNT = 1000;
const BATCH_SIZE = 500;

type Sex = "male" | "female";

// Picks the masculine or feminine form of a word depending on the contact's sex.
const g = (sex: Sex, male: string, female: string) => (sex === "male" ? male : female);

const universities = [
  "МГУ",
  "МФТИ",
  "ВШЭ",
  "СПбГУ",
  "МГТУ им. Баумана",
  "МИФИ",
  "РЭУ им. Плеханова",
  "МГИМО",
  "УрФУ",
  "НГУ",
];
const companies = [
  "Яндексе",
  "Сбере",
  "Тинькофф",
  "Озоне",
  "Авито",
  "МТС",
  "Лаборатории Касперского",
  "VK",
  "Альфа-Банке",
  "Х5",
  "небольшом стартапе",
  "рекламном агентстве",
];
const events = [
  "HighLoad++",
  "TechLead Conf",
  "РИФ",
  "Product Camp",
  "Дне маркетинга",
  "митапе по Python",
  "бизнес-завтраке",
  "конференции по UX",
  "Codefest",
  "выставке ЭкспоЭлектроника",
];
const places = [
  "Сочи",
  "Казань",
  "Калининград",
  "Стамбул",
  "Ереван",
  "Тбилиси",
  "Алтай",
  "Карелию",
  "Байкал",
  "Минск",
  "Питер",
];
const hobbies = [
  "йоге",
  "бегу",
  "скалолазанию",
  "теннису",
  "шахматам",
  "танцам",
  "фотографии",
  "гончарному делу",
  "английскому",
  "плаванию",
];
const topics = [
  "запуск нового проекта",
  "переезд в другой город",
  "смену работы",
  "ремонт квартиры",
  "поступление детей в школу",
  "идею своего бизнеса",
  "инвестиции",
  "отпуск на море",
  "найм разработчиков",
  "покупку машины",
  "свадьбу",
  "курсы по дизайну",
  "книгу, которую пишет",
  "открытие кофейни",
];
const books = [
  "«Мастер и Маргарита»",
  "«Думай медленно… решай быстро»",
  "«Sapiens»",
  "«Атлант расправил плечи»",
  "«Чистый код»",
  "«Пикник на обочине»",
  "«Дюна»",
  "«Год, когда я научился»",
];
const months = [
  "январе",
  "феврале",
  "марте",
  "апреле",
  "мае",
  "июне",
  "июле",
  "августе",
  "сентябре",
  "октябре",
  "ноябре",
  "декабре",
];
const weekdays = [
  "в понедельник",
  "во вторник",
  "в среду",
  "в четверг",
  "в пятницу",
  "в субботу",
  "на следующей неделе",
  "после праздников",
];

function about(sex: Sex): string {
  const relation = faker.helpers.arrayElement([
    g(sex, "Однокурсник", "Однокурсница"),
    g(sex, "Бывший коллега", "Бывшая коллега"),
    g(sex, "Коллега", "Коллега"),
    g(sex, "Сосед", "Соседка"),
    g(sex, "Друг детства", "Подруга детства"),
    g(sex, "Знакомый", "Знакомая"),
    g(sex, "Друг", "Подруга"),
    g(sex, "Одноклассник", "Одноклассница"),
    g(sex, "Друг брата", "Подруга сестры"),
    g(sex, "Бывший руководитель", "Бывшая руководительница"),
    "Клиент",
    "Партнёр по проекту",
  ]);
  const occupation = faker.helpers.arrayElement([
    `работает в ${faker.helpers.arrayElement(companies)}`,
    "дизайнер интерфейсов",
    "юрист, специализируется на договорах",
    "frontend-разработчик",
    "владеет кофейней",
    "преподаёт английский",
    "риелтор",
    "архитектор",
    "HR в IT-компании",
    "маркетолог",
    "фотограф",
    "бухгалтер, ведёт ИП",
    "врач-терапевт",
    "делает мебель на заказ",
    "журналист",
    "психолог",
    "продакт-менеджер",
    "аналитик данных",
    "тренер по фитнесу",
    "стоматолог",
    "автомеханик, свой сервис",
    "учитель математики",
    "SMM-специалист",
    "финансовый консультант",
  ]);
  return `${relation}, ${occupation}`;
}

function howWeMet(): string {
  const year = faker.number.int({ min: 2008, max: 2025 });
  return faker.helpers.arrayElement([
    `Учились вместе в ${faker.helpers.arrayElement(universities)}`,
    `Познакомились на ${faker.helpers.arrayElement(events)} в ${year} году`,
    `Работали вместе в ${faker.helpers.arrayElement(companies)}`,
    "Соседи по подъезду",
    "Соседи по даче",
    `Познакомил ${faker.helpers.arrayElement(firstNames.male)} на дне рождения`,
    `Познакомила ${faker.helpers.arrayElement(firstNames.female)}, общие друзья`,
    `Вместе ходили на курсы по ${faker.helpers.arrayElement(hobbies)}`,
    `Познакомились в поездке в ${faker.helpers.arrayElement(places)}`,
    "Родители дружат с детства",
    "Через рабочий чат, потом встретились вживую",
    `Вместе занимаемся ${faker.helpers.arrayElement(["бегом", "теннисом", "йогой", "плаванием", "скалолазанием"])}`,
    "Учились в одном классе",
    `На свадьбе у общих друзей в ${year} году`,
  ]);
}

function noteBody(sex: Sex): string {
  return faker.helpers.arrayElement([
    `Созвонились. Договорились встретиться в ${faker.helpers.arrayElement(months)} и обсудить ${faker.helpers.arrayElement(topics)}.`,
    `${g(sex, "Обещал", "Обещала")} прислать контакты хорошего ${faker.helpers.arrayElement(["стоматолога", "юриста", "риелтора", "бухгалтера", "автомеханика"])}.`,
    "Поздравление с днём рождения. Давно не общались — договорились видеться чаще.",
    `Обсуждали ${faker.helpers.arrayElement(topics)}. Договорились вернуться к разговору через месяц.`,
    `Вернуть книгу ${faker.helpers.arrayElement(books)} при встрече.`,
    `${g(sex, "Посоветовал", "Посоветовала")} книгу ${faker.helpers.arrayElement(books)} — купить и прочитать.`,
    `Встретились на кофе. ${g(sex, "Рассказывал", "Рассказывала")} про ${faker.helpers.arrayElement(topics)}.`,
    `Договорились созвониться ${faker.helpers.arrayElement(weekdays)}.`,
    `${g(sex, "Просил", "Просила")} помочь с резюме — отправить замечания до конца недели.`,
    "Отправлена ссылка на вакансию — ждёт ответа от рекрутера.",
    `${g(sex, "Переехал", "Переехала")} в ${faker.location.city()}. Новый адрес — в переписке.`,
    `${g(sex, "Звал", "Звала")} на ${faker.helpers.arrayElement(["шашлыки", "концерт", "день рождения", "новоселье", "футбол"])} — подтвердить участие.`,
    `${g(sex, "Занял", "Заняла")} ${faker.number.int({ min: 2, max: 30 }) * 1000} ₽, вернёт до ${faker.helpers.arrayElement(["конца месяца", "Нового года", "лета", "осени", "зарплаты"])}.`,
    `${g(sex, "Поделился", "Поделилась")} идеей совместного проекта — обсудить подробнее при встрече.`,
    `Дети ходят в одну секцию по ${faker.helpers.arrayElement(hobbies)}.`,
    `Сменил${g(sex, "", "а")} работу — теперь ${faker.helpers.arrayElement(["тимлид", "руководитель отдела", "фрилансер", "консультант", "сооснователь стартапа"])}.`,
  ]);
}

// Common first names, so the test list looks like a real address book.
const firstNames: Record<Sex, string[]> = {
  male: [
    "Александр",
    "Алексей",
    "Андрей",
    "Антон",
    "Артём",
    "Борис",
    "Вадим",
    "Валерий",
    "Василий",
    "Виктор",
    "Виталий",
    "Владимир",
    "Владислав",
    "Вячеслав",
    "Георгий",
    "Глеб",
    "Григорий",
    "Даниил",
    "Денис",
    "Дмитрий",
    "Евгений",
    "Егор",
    "Иван",
    "Игорь",
    "Илья",
    "Кирилл",
    "Константин",
    "Лев",
    "Леонид",
    "Максим",
    "Марк",
    "Матвей",
    "Михаил",
    "Никита",
    "Николай",
    "Олег",
    "Павел",
    "Пётр",
    "Роман",
    "Руслан",
    "Сергей",
    "Степан",
    "Тимофей",
    "Тимур",
    "Фёдор",
    "Юрий",
    "Ярослав",
  ],
  female: [
    "Александра",
    "Алина",
    "Алиса",
    "Анастасия",
    "Анна",
    "Арина",
    "Валентина",
    "Валерия",
    "Вера",
    "Вероника",
    "Виктория",
    "Галина",
    "Дарья",
    "Диана",
    "Ева",
    "Евгения",
    "Екатерина",
    "Елена",
    "Елизавета",
    "Жанна",
    "Злата",
    "Инна",
    "Ирина",
    "Карина",
    "Кира",
    "Ксения",
    "Лариса",
    "Любовь",
    "Людмила",
    "Маргарита",
    "Марина",
    "Мария",
    "Милана",
    "Надежда",
    "Наталья",
    "Нина",
    "Оксана",
    "Ольга",
    "Полина",
    "Светлана",
    "София",
    "Татьяна",
    "Ульяна",
    "Юлия",
    "Яна",
  ],
};

const translitMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};
const translit = (text: string) =>
  [...text.toLowerCase()].map((char) => translitMap[char] ?? char).join("");

function email(firstName: string, lastName: string): string {
  const user = faker.helpers.arrayElement([
    `${translit(firstName)}.${translit(lastName)}`,
    `${translit(firstName)[0]}.${translit(lastName)}`,
    `${translit(lastName)}${faker.number.int({ min: 1, max: 99 })}`,
    `${translit(firstName)}_${translit(lastName)}`,
  ]);
  const domain = faker.helpers.arrayElement([
    "gmail.com",
    "yandex.ru",
    "mail.ru",
    "ya.ru",
    "inbox.ru",
    "icloud.com",
  ]);
  return `${user}@${domain}`;
}

function phone(): string {
  const n = () => faker.string.numeric(1);
  return `+7 9${n()}${n()} ${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(2)}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm env:init` to create .env.");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    const [{ value: existing }] = await db.select({ value: count() }).from(contacts);
    if (existing > 0) {
      console.log(`Database already has ${existing} contacts - seed skipped, nothing changed.`);
      return;
    }

    faker.seed(2026);
    const now = new Date();
    const usedNames = new Set<string>();

    const contactRows: { sex: Sex; row: typeof contacts.$inferInsert }[] = [];
    while (contactRows.length < CONTACT_COUNT) {
      const sex = faker.person.sexType() as Sex;
      const firstName = faker.helpers.arrayElement(firstNames[sex]);
      const lastName = faker.person.lastName(sex);
      const name = `${firstName} ${lastName}`;
      if (usedNames.has(name)) continue;
      usedNames.add(name);

      const createdAt = faker.date.past({ years: 3, refDate: now });
      contactRows.push({
        sex,
        row: {
          name,
          about: faker.datatype.boolean(0.9) ? about(sex) : null,
          howWeMet: faker.datatype.boolean(0.85) ? howWeMet() : null,
          phone: faker.datatype.boolean(0.9) ? phone() : null,
          email: faker.datatype.boolean(0.65) ? email(firstName, lastName) : null,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    const noteRows: (typeof notes.$inferInsert)[] = [];
    for (let offset = 0; offset < contactRows.length; offset += BATCH_SIZE) {
      const batch = contactRows.slice(offset, offset + BATCH_SIZE);
      const inserted = await db
        .insert(contacts)
        .values(batch.map(({ row }) => row))
        .returning({ id: contacts.id });

      inserted.forEach(({ id }, i) => {
        const contact = batch[i];
        const noteCount = faker.helpers.weightedArrayElement([
          { weight: 25, value: 0 },
          { weight: 30, value: 1 },
          { weight: 25, value: 2 },
          { weight: 12, value: 3 },
          { weight: 8, value: 5 },
        ]);
        for (let n = 0; n < noteCount; n++) {
          noteRows.push({
            contactId: id,
            body: noteBody(contact.sex),
            createdAt: faker.date.between({ from: contact.row.createdAt!, to: now }),
          });
        }
      });
    }

    for (let offset = 0; offset < noteRows.length; offset += BATCH_SIZE) {
      await db.insert(notes).values(noteRows.slice(offset, offset + BATCH_SIZE));
    }

    // A contact counts as updated when its latest note was written.
    await client`
      update contacts c set updated_at = n.last_note_at
      from (select contact_id, max(created_at) as last_note_at from notes group by contact_id) n
      where n.contact_id = c.id
    `;

    console.log(`Seeded ${contactRows.length} contacts and ${noteRows.length} notes.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
