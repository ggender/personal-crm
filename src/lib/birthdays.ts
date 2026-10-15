// The rules about birthdays: the next one, the days until it, the age, the check of a typed date.
// Shared by the server and the browser: no server-only imports, and no zod either (it would add the
// whole library to the browser bundle). "Today" is always a parameter, so a test can pick any day.
// Days are texts like "2026-10-15" and are worked out in UTC, so no time zone shifts them.

import { APP_TIME_ZONE } from "@/lib/keep-in-touch";

const DAY_MS = 24 * 60 * 60 * 1000;
export const UPCOMING_BIRTHDAY_DAYS = 7;
export const MIN_BIRTH_YEAR = 1900;

export const BIRTH_DATE_ERRORS = {
  dayAndMonth: "Укажите день и месяц",
  noSuchDate: "Такой даты нет",
  year: "Проверьте год",
  notYet: "Эта дата ещё не наступила",
} as const;

export type BirthDate = { day: number; month: number; year: number | null };

const todayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day it is now in the owner's time zone: "2026-10-15". */
export const appToday = (now: Date = new Date()) => todayFormat.format(now);

const pad = (value: number, length: number) => String(value).padStart(length, "0");
const toDay = (year: number, month: number, day: number) =>
  `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
const yearOf = (day: string) => Number(day.slice(0, 4));
const monthOf = (day: string) => Number(day.slice(5, 7));
const dayOf = (day: string) => Number(day.slice(8, 10));

export const isLeapYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** How many days a month has; without a year February has 29. */
export function daysInMonth(month: number, year: number | null) {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** The day a birthday is celebrated in a year: 29 February becomes 28 February in a common year. */
function birthdayIn(year: number, month: number, day: number) {
  return month === 2 && day === 29 && !isLeapYear(year)
    ? toDay(year, 2, 28)
    : toDay(year, month, day);
}

/** The nearest birthday from today on (today included): this year, or next year if it has passed. */
export function nextBirthday(month: number, day: number, today: string) {
  const thisYear = birthdayIn(yearOf(today), month, day);
  return thisYear >= today ? thisYear : birthdayIn(yearOf(today) + 1, month, day);
}

const utcTime = (day: string) => Date.UTC(yearOf(day), monthOf(day) - 1, dayOf(day));

/** Whole days from `today` to `next`. */
export const daysUntil = (next: string, today: string) =>
  Math.round((utcTime(next) - utcTime(today)) / DAY_MS);

/** Years completed on `today`; null when the year of birth is unknown. */
export function fullYears({ day, month, year }: BirthDate, today: string) {
  if (year === null) return null;
  const thisYear = yearOf(today);
  return thisYear - year - (birthdayIn(thisYear, month, day) > today ? 1 : 0);
}

/**
 * Reads one part of a date typed into the form: "" is not given (null), a number of at most
 * `maxDigits` digits is that number, anything else cannot be read (NaN).
 */
export function parseBirthPart(text: string, maxDigits: number) {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return new RegExp(`^\\d{1,${maxDigits}}$`).test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** Day and month: one or two digits; the year: exactly four. */
export const parseBirthDay = (text: string) => parseBirthPart(text, 2);
export const parseBirthYear = (text: string) => {
  const year = parseBirthPart(text, 4);
  return year !== null && text.trim().length !== 4 ? Number.NaN : year;
};

/**
 * Checks a date typed into the form (the parts as `parseBirthDay` and `parseBirthYear` read them).
 * Returns the message for the owner, or null when the date is fine or not given at all.
 */
export function birthDateError(
  day: number | null,
  month: number | null,
  year: number | null,
  today: string,
) {
  if (day === null && month === null && year === null) return null;
  if (day === null || month === null) return BIRTH_DATE_ERRORS.dayAndMonth;

  if (year !== null && !(year >= MIN_BIRTH_YEAR && year <= yearOf(today)))
    return BIRTH_DATE_ERRORS.year;

  // NaN fails every comparison below, so a part that could not be read is "no such date".
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(month, year)))
    return BIRTH_DATE_ERRORS.noSuchDate;

  if (year !== null && toDay(year, month, day) > today) return BIRTH_DATE_ERRORS.notYet;
  return null;
}
