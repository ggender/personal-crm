import { z } from "zod";

// Empty optional fields are stored as NULL rather than as empty strings.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .transform((value) => value || null);

export const contactInputSchema = z.object({
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
  firstNote: optionalText(5000),
});

export type ContactInput = z.infer<typeof contactInputSchema>;
export type ContactField = keyof ContactInput;

// Editing changes the contact's own fields; notes are edited separately.
export const contactUpdateSchema = contactInputSchema.omit({ firstNote: true });

export type ContactUpdate = z.infer<typeof contactUpdateSchema>;

export const noteInputSchema = z.object({
  body: z.string().trim().min(1, "Напишите текст заметки").max(5000, "Не длиннее 5000 символов"),
});

/** Parses a route id like "42"; returns null for anything that is not a positive integer. */
export function parseId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
