/*
 * Calendar days for the keep-in-touch tests, worked out here on their own, apart from the app's SQL:
 * a day is a "YYYY-MM-DD" text in Moscow time, months are calendar months clamped to the month's end.
 * No imports, so both Vitest and Playwright can use it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const moscowDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Moscow calendar day of a moment: "2026-10-07". */
export const moscowDay = (date: Date) => moscowDayFormat.format(date);

export const moscowToday = () => moscowDay(new Date());

/** A moment `days` days before now (Moscow has no daylight saving time, so it is `days` days back). */
export const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/** Noon of a Moscow calendar day. */
export const moscowNoon = (day: string) => new Date(`${day}T12:00:00+03:00`);

const parse = (day: string) => new Date(`${day}T00:00:00Z`);
const print = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (day: string, days: number) =>
  print(new Date(parse(day).getTime() + days * DAY_MS));

/** 31 January + 1 month = 28 (29) February. */
export function addMonths(day: string, months: number) {
  const date = parse(day);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return print(target);
}

/** Days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS);

const ruDayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const ruDayWithYearFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** How the app writes a due date: "14 октября", or "7 октября 2027 г." in another year. */
export const ruDay = (day: string) =>
  (day.slice(0, 4) === moscowToday().slice(0, 4) ? ruDayFormat : ruDayWithYearFormat).format(
    parse(day),
  );
