import { type BirthDate, fullYears } from "@/lib/birthdays";
import { APP_TIME_ZONE } from "@/lib/keep-in-touch";

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const formatDateTime = (date: Date) => dateTimeFormat.format(date);
export const formatDate = (date: Date) => dateFormat.format(date);

// A calendar day like "2026-10-14" is read and shown in UTC, so no time zone shifts it.
const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayWithYearFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const yearFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: APP_TIME_ZONE });

/** "2026-10-14" -> "14 октября"; a day outside the current year gets it: "7 октября 2027 г.". */
export function formatDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  const sameYear = day.slice(0, 4) === yearFormat.format(new Date());
  return (sameYear ? dayFormat : dayWithYearFormat).format(date);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const pluralRules = new Intl.PluralRules("ru-RU");

/** Russian plural form: plural(3, ["контакт", "контакта", "контактов"]) -> "3 контакта". */
export function plural(value: number, [one, few, many]: [string, string, string]) {
  const form = pluralRules.select(value);
  const word = form === "one" ? one : form === "few" ? few : many;
  return `${value.toLocaleString("ru-RU")} ${word}`;
}

/** "просрочено на 3 дня"; a no-break space keeps the number on one line with its word. */
export const formatOverdue = (days: number) =>
  `просрочено на ${plural(days, ["день", "дня", "дней"]).replace(" ", "\u00a0")}`;

// Month names in the genitive case, written out: no time zone can shift a day typed in a form.
export const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** "18 октября". */
export const formatDayMonth = (day: number, month: number) =>
  `${day} ${MONTHS_GENITIVE[month - 1]}`;

/**
 * The date of birth for the contact page: "18 октября 1990 · 35 лет", "18 октября" without a year,
 * no age for a person under one year. Null when there is no date.
 */
export function formatBirthDate(
  day: number | null,
  month: number | null,
  year: number | null,
  today: string,
) {
  if (day === null || month === null) return null;
  const birth: BirthDate = { day, month, year };
  const age = fullYears(birth, today);
  const text = formatDayMonth(day, month);
  if (year === null) return text;
  return age ? `${text} ${year} · ${plural(age, ["год", "года", "лет"])}` : `${text} ${year}`;
}

/**
 * The line under the name in "Скоро день рождения": "Сегодня · исполняется 36", "Завтра, 16 октября",
 * "Через 3 дня, 18 октября · исполнится 36". The age is left out when the year is unknown.
 */
export function formatBirthdayWhen(days: number, next: string, turningAge: number | null) {
  const date = formatDayMonth(Number(next.slice(8, 10)), Number(next.slice(5, 7)));
  const when =
    days === 0
      ? "Сегодня"
      : days === 1
        ? `Завтра, ${date}`
        : `Через ${plural(days, ["день", "дня", "дней"])}, ${date}`;
  if (turningAge === null) return when;
  return `${when} · ${days === 0 ? "исполняется" : "исполнится"} ${turningAge}`;
}
