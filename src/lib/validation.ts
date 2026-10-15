import { z } from "zod";

import { appToday, birthDateError, parseBirthDay, parseBirthYear } from "@/lib/birthdays";
import { CONTACT_FREQUENCIES } from "@/lib/keep-in-touch";

// Empty optional fields are stored as NULL rather than as empty strings.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .transform((value) => value || null);

// The date of birth comes as three texts, "" for not chosen. Each becomes a number or null; a text
// that is not a number stays NaN and is refused by the check of the whole date below. Missing in the
// data is the same as empty, so callers that know nothing about birthdays keep working.
const birthDayPart = z.string().trim().default("").transform(parseBirthDay);
const birthYearPart = z.string().trim().default("").transform(parseBirthYear);

const contactFieldsSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(200, "Не длиннее 200 символов"),
  about: optionalText(500),
  howWeMet: optionalText(1000),
  phone: z
    .string()
    .trim()
    .max(50, "Не длиннее 50 символов")
    .refine(
      (value) => value === "" || /^\+?[\d\s()-]{5,}$/.test(value),
      "Только цифры, пробелы, «+», «-» и скобки",
    )
    .transform((value) => value || null),
  email: z
    .string()
    .trim()
    .max(200, "Не длиннее 200 символов")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Проверьте адрес почты")
    .transform((value) => value || null),
  birthDay: birthDayPart,
  birthMonth: birthDayPart,
  birthYear: birthYearPart,
  firstNote: optionalText(5000),
});

/*
 * The date of birth is checked as a whole, after its parts: one message for the three of them, under
 * the key "birthDate". Added to each schema separately: zod cannot safely `omit` from a checked one.
 */
function checkBirthDate(
  data: { birthDay: number | null; birthMonth: number | null; birthYear: number | null },
  ctx: z.RefinementCtx,
) {
  const message = birthDateError(data.birthDay, data.birthMonth, data.birthYear, appToday());
  if (message) ctx.addIssue({ code: "custom", path: ["birthDate"], message });
}

export const contactInputSchema = contactFieldsSchema.superRefine(checkBirthDate);

export type ContactInput = z.infer<typeof contactInputSchema>;

/** The fields of the contact form; "birthDate" is the one error shown under the three date parts. */
export type ContactField =
  | "name"
  | "about"
  | "howWeMet"
  | "phone"
  | "email"
  | "birthDay"
  | "birthMonth"
  | "birthYear"
  | "birthDate"
  | "firstNote";

// Editing changes the contact's own fields; notes are edited separately.
export const contactUpdateSchema = contactFieldsSchema
  .omit({ firstNote: true })
  .superRefine(checkBirthDate);

export type ContactUpdate = z.infer<typeof contactUpdateSchema>;

export const noteInputSchema = z.object({
  body: z.string().trim().min(1, "Напишите текст заметки").max(5000, "Не длиннее 5000 символов"),
});

export const LOGIN_EMAIL_ERROR = "Проверьте адрес почты";

/**
 * The email on the login page: spaces at both ends are dropped and letters are made small, so
 * "Anna@Example.com" and "anna@example.com" are one address. At most 254 characters (the limit of
 * an email address). The server checks it itself, whatever the form did.
 */
export const loginEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email(LOGIN_EMAIL_ERROR).max(254, LOGIN_EMAIL_ERROR));

/** A group name: 1-50 characters, spaces at both ends are dropped. */
export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название")
  .max(50, "Не длиннее 50 символов");

/** Keep in touch: null means "Не задано". */
export const contactFrequencySchema = z.enum(CONTACT_FREQUENCIES).nullable();

/** What the browser sends back to undo "Пообщались": the mark it set and the value before it. */
export const undoContactedSchema = z.object({
  marked: z.iso.datetime(),
  previous: z.iso.datetime().nullable(),
});

/** Parses a route id like "42"; returns null for anything that is not a positive integer. */
export function parseId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
