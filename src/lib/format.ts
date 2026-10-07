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
