// Fills an empty database with realistic demo contacts and notes.
// Refuses to run if contacts already exist, so it never touches real data.
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl, loadEnvFile } from "../src/db/connection-url";
import { contacts, notes } from "../src/db/schema";

const CONTACT_COUNT = 1000;

// Deterministic PRNG (mulberry32) so every run produces the same data.
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261002);
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];
const chance = (probability: number) => random() < probability;
const randomInt = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

const MALE_FIRST_NAMES = [
  "Александр", "Алексей", "Андрей", "Антон", "Артём", "Борис", "Вадим",
  "Валерий", "Василий", "Виктор", "Виталий", "Владимир", "Владислав",
  "Всеволод", "Георгий", "Глеб", "Григорий", "Даниил", "Денис", "Дмитрий",
  "Евгений", "Егор", "Иван", "Игорь", "Илья", "Кирилл", "Константин", "Лев",
  "Леонид", "Максим", "Марк", "Матвей", "Михаил", "Никита", "Николай", "Олег",
  "Павел", "Пётр", "Роман", "Руслан", "Семён", "Сергей", "Станислав",
  "Степан", "Тимофей", "Тимур", "Фёдор", "Юрий", "Ярослав",
] as const;

const FEMALE_FIRST_NAMES = [
  "Александра", "Алина", "Алёна", "Алиса", "Анастасия", "Анна", "Антонина",
  "Валентина", "Валерия", "Вера", "Вероника", "Виктория", "Галина", "Дарья",
  "Диана", "Евгения", "Екатерина", "Елена", "Елизавета", "Жанна", "Злата",
  "Зоя", "Ирина", "Карина", "Кира", "Ксения", "Лариса", "Лидия", "Любовь",
  "Людмила", "Маргарита", "Марина", "Мария", "Милана", "Надежда", "Наталья",
  "Нина", "Оксана", "Олеся", "Ольга", "Полина", "Светлана", "София",
  "Тамара", "Татьяна", "Ульяна", "Юлия", "Яна",
] as const;

// Male surname forms; female forms are derived by gender rules below.
const SURNAMES = [
  "Абрамов", "Алексеев", "Андреев", "Белов", "Беляев", "Богданов", "Борисов",
  "Быков", "Васильев", "Виноградов", "Волков", "Воробьёв", "Гаврилов",
  "Голубев", "Горбунов", "Григорьев", "Гусев", "Давыдов", "Денисов",
  "Дмитриев", "Егоров", "Ершов", "Жуков", "Зайцев", "Захаров", "Зуев",
  "Иванов", "Ильин", "Казаков", "Калинин", "Карпов", "Киселёв", "Ковалёв",
  "Козлов", "Колесников", "Комаров", "Кондратьев", "Королёв", "Котов",
  "Крылов", "Кудрявцев", "Кузнецов", "Кузьмин", "Лебедев", "Макаров",
  "Медведев", "Мельников", "Миронов", "Михайлов", "Морозов", "Никитин",
  "Николаев", "Новиков", "Орлов", "Осипов", "Павлов", "Панов", "Петров",
  "Попов", "Прохоров", "Романов", "Румянцев", "Рыбаков", "Савельев",
  "Семёнов", "Сергеев", "Смирнов", "Соболев", "Соколов", "Соловьёв",
  "Степанов", "Тарасов", "Тимофеев", "Титов", "Тихонов", "Третьяков",
  "Фёдоров", "Филиппов", "Фомин", "Фролов", "Чернов", "Шаров", "Широков",
  "Щербаков", "Яковлев", "Белоусов", "Ветров", "Гордеев", "Лавров",
  "Субботин", "Островский", "Вишневский", "Покровский", "Добровольский",
  "Черных", "Седых", "Шевчук", "Мельничук", "Бондаренко", "Ткаченко",
  "Литвиненко", "Ким", "Цой", "Галиев", "Сафин", "Хабибуллин", "Алиев",
] as const;

function femaleSurname(surname: string): string {
  if (/(ов|ев|ёв|ин|ын)$/.test(surname)) return `${surname}а`;
  if (surname.endsWith("ский")) return surname.replace(/ский$/, "ская");
  if (surname.endsWith("цкий")) return surname.replace(/цкий$/, "цкая");
  return surname; // Indeclinable: Черных, Шевчук, Бондаренко, Ким
}

type Gendered = string | readonly [male: string, female: string];

const byGender = (value: Gendered, isFemale: boolean) =>
  typeof value === "string" ? value : value[isFemale ? 1 : 0];

const ABOUT: readonly Gendered[] = [
  "Фронтенд-разработчик в финтех-стартапе",
  "Бэкенд-разработчик, пишет на Go",
  "Продакт-менеджер в крупном маркетплейсе",
  "Дизайнер интерфейсов, фрилансер",
  "Основатель небольшой студии веб-разработки",
  "Юрист, специализируется на договорах",
  "Бухгалтер, ведёт ИП и небольшие ООО",
  "Врач-терапевт в частной клинике",
  "Стоматолог",
  "Учитель математики в школе",
  "Преподаватель английского",
  "Риелтор, помогает с арендой и покупкой квартир",
  "Фотограф, снимает свадьбы и портреты",
  "Тренер по плаванию",
  "Фитнес-тренер",
  "Архитектор",
  "Инженер-строитель, прораб",
  "Мастер по ремонту квартир",
  "Автомеханик, свой сервис",
  "HR-менеджер в IT-компании",
  "Рекрутер, закрывает вакансии разработчиков",
  "Маркетолог, ведёт рекламу в соцсетях",
  "Аналитик данных",
  "Тестировщик",
  "DevOps-инженер",
  "Журналист, пишет про технологии",
  "Редактор в издательстве",
  "Психолог",
  "Финансовый консультант",
  "Владелец кофейни",
  "Шеф-повар в ресторане",
  "Музыкант, играет на гитаре в группе",
  ["Студент магистратуры", "Студентка магистратуры"],
  ["Студент последнего курса", "Студентка последнего курса"],
  ["Сосед по лестничной клетке", "Соседка по лестничной клетке"],
  ["Двоюродный брат", "Двоюродная сестра"],
  ["Друг детства", "Подруга детства"],
  ["Бывший коллега, сейчас в другой компании", "Бывшая коллега, сейчас в другой компании"],
  "Руководитель отдела продаж",
  "Нотариус",
  "Ветеринар",
  "Организатор мероприятий",
  "Переводчик с немецкого",
  "Владелец автосервиса",
  "Мастер маникюра",
  "Парикмахер",
  "Инвестор, вкладывается в ранние стартапы",
  "Научный сотрудник, биолог",
  "Пилот гражданской авиации",
];

const HOW_WE_MET = [
  "Учились вместе в школе",
  "Однокурсники по университету",
  "Работали вместе в прошлой компании",
  "Коллега по текущей работе",
  "Познакомились на конференции",
  "Познакомились на митапе разработчиков",
  "Познакомил общий друг",
  "Соседи по дому",
  "Вместе ходим в спортзал",
  "Познакомились в походе",
  "Познакомились на свадьбе у друзей",
  "Родители дружат семьями",
  "Вместе были на курсах английского",
  "Познакомились в отпуске",
  "Нашёл через рекомендацию знакомых",
  "Родственник",
  "Познакомились на дне рождения у друга",
  "Сидели рядом в коворкинге",
  "Вместе волонтёрили",
  "Познакомились в чате района",
  "Клиент по прошлому проекту",
  "Подрядчик по ремонту",
  "Вместе играли в футбол по выходным",
  "Познакомились в самолёте",
  "Вместе учились на курсах программирования",
] as const;

const EVENTS = [
  "конференции",
  "митапе",
  "дне рождения",
  "вечере выпускников",
  "корпоративе",
  "даче у друзей",
  "хакатоне",
  "презентации проекта",
] as const;

const TOPICS = [
  "новой работе",
  "переезде в другой город",
  "ремонте квартиры",
  "поездке в горы",
  "своём стартапе",
  "детях и школе",
  "курсах, которые проходит",
  "книге, которую читает",
  "планах на отпуск",
  "сложном проекте на работе",
  "покупке машины",
  "подготовке к марафону",
] as const;

// Templates get the contact's gender so verbs agree: "рассказал" / "рассказала".
const NOTE_TEMPLATES: ReadonlyArray<(isFemale: boolean) => string> = [
  () => "Созвонились, договорились встретиться на следующей неделе.",
  (f) => `Встретились на ${pick(EVENTS)}. ${f ? "Рассказала" : "Рассказал"} о ${pick(TOPICS)}.`,
  (f) => `${f ? "Обещала" : "Обещал"} прислать контакт знакомого юриста.`,
  () => "Договорились созвониться в конце месяца и обсудить совместный проект.",
  () => "Был день рождения, поздравления отправлены. Любит хороший кофе и настольные игры.",
  (f) => `${f ? "Попросила" : "Попросил"} совета по ${pick(["резюме", "собеседованию", "выбору ноутбука", "аренде квартиры", "выбору школы"])}. Скинуть ссылки на полезные материалы.`,
  () => `Обсудили планы на ${pick(["лето", "осень", "следующий год", "праздники"])}. Договорились вернуться к теме через пару недель.`,
  () => `Пообедали вместе. Ищет ${pick(["дизайнера", "разработчика", "бухгалтера", "репетитора для ребёнка", "хорошего стоматолога"])}: поспрашивать знакомых.`,
  (f) => `${f ? "Вернула" : "Вернул"} книгу, которую ${f ? "брала" : "брал"} в прошлый раз.`,
  (f) => `Переписывались в мессенджере, ${f ? "скинула" : "скинул"} фото из поездки.`,
  (f) => `Договорились: я помогаю с презентацией, ${f ? "она" : "он"} знакомит с инвестором.`,
  (f) => `${f ? "Звала" : "Звал"} на ${pick(["концерт", "выставку", "футбол", "дачу", "новоселье"])} в субботу.`,
  (f) => `${f ? "Сменила" : "Сменил"} номер телефона, новый номер уже в карточке.`,
  () => "Напомнить про встречу за неделю: сейчас много работы.",
  (f) => `${f ? "Рассказала" : "Рассказал"} о ${pick(TOPICS)}. Договорились, что помогу, если понадобится.`,
];

const EMAIL_DOMAINS = [
  "gmail.com", "yandex.ru", "mail.ru", "outlook.com", "icloud.com", "proton.me",
] as const;

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const transliterate = (value: string) =>
  [...value.toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("");

function makePhone(): string {
  const code = pick(["900", "903", "905", "910", "915", "916", "921", "925", "926", "929", "950", "958", "977", "985", "999"]);
  const digits = () => String(randomInt(0, 99)).padStart(2, "0");
  return `+7 ${code} ${randomInt(100, 999)}-${digits()}-${digits()}`;
}

function makeEmail(firstName: string, surname: string, used: Set<string>) {
  const first = transliterate(firstName);
  const last = transliterate(surname);
  const base = pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${last}${randomInt(70, 99)}`,
    `${first}_${last}`,
  ]);
  let local = base;
  for (let suffix = 2; used.has(local); suffix++) local = `${base}${suffix}`;
  used.add(local);
  return `${local}@${pick(EMAIL_DOMAINS)}`;
}

function randomDateWithinDays(days: number, now: Date): Date {
  const offsetMs = random() * days * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - offsetMs);
}

async function main() {
  loadEnvFile();
  const client = postgres(getDatabaseUrl(), { max: 1 });
  const db = drizzle(client, { casing: "snake_case" });

  try {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(contacts);
    if (existing > 0) {
      console.log(
        `Seed skipped: the database already has ${existing} contacts. ` +
          "The seed only fills an empty database.",
      );
      return;
    }

    const now = new Date();
    const usedEmails = new Set<string>();
    const contactRows = Array.from({ length: CONTACT_COUNT }, () => {
      const isFemale = chance(0.5);
      const firstName = pick(isFemale ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
      const maleSurname = pick(SURNAMES);
      const surname = isFemale ? femaleSurname(maleSurname) : maleSurname;
      const createdAt = randomDateWithinDays(3 * 365, now);
      return {
        name: `${firstName} ${surname}`,
        about: chance(0.85) ? byGender(pick(ABOUT), isFemale) : null,
        howWeMet: chance(0.9) ? pick(HOW_WE_MET) : null,
        phone: chance(0.8) ? makePhone() : null,
        email: chance(0.7) ? makeEmail(firstName, surname, usedEmails) : null,
        createdAt,
        updatedAt: createdAt,
      };
    });

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(contacts)
        .values(contactRows)
        .returning({
          id: contacts.id,
          name: contacts.name,
          createdAt: contacts.createdAt,
        });

      const noteRows = inserted.flatMap(({ id, name, createdAt }) => {
        // Male and female first-name lists don't overlap, so gender follows from the name.
        const isFemale = (FEMALE_FIRST_NAMES as readonly string[]).includes(
          name.split(" ")[0],
        );
        const noteCount = pick([0, 0, 1, 1, 2, 2, 3, 4]);
        return Array.from({ length: noteCount }, () => {
          const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
          return {
            contactId: id,
            body: pick(NOTE_TEMPLATES)(isFemale),
            createdAt: randomDateWithinDays(ageDays, now),
          };
        });
      });

      // Insert in chunks to stay well below the Postgres parameter limit.
      for (let i = 0; i < noteRows.length; i += 500) {
        await tx.insert(notes).values(noteRows.slice(i, i + 500));
      }

      console.log(
        `Seeded ${inserted.length} contacts and ${noteRows.length} notes.`,
      );
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
