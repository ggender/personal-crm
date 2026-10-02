// Parses and validates contact form fields. Shared by create and update actions.

export const CONTACT_FIELDS = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactFormValues = Record<ContactField, string>;

export type ContactInput = {
  name: string;
  about: string | null;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
};

const MAX_LENGTH: Record<ContactField, number> = {
  name: 200,
  about: 1000,
  howWeMet: 1000,
  phone: 50,
  email: 254,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParseResult =
  | { ok: true; data: ContactInput }
  | {
      ok: false;
      values: ContactFormValues;
      errors: Partial<Record<ContactField, string>>;
    };

export function parseContactForm(formData: FormData): ParseResult {
  const values = Object.fromEntries(
    CONTACT_FIELDS.map((field) => [
      field,
      String(formData.get(field) ?? "").trim(),
    ]),
  ) as ContactFormValues;

  const errors: Partial<Record<ContactField, string>> = {};
  if (!values.name) {
    errors.name = "Укажите имя";
  }
  if (values.email && !EMAIL_PATTERN.test(values.email)) {
    errors.email = "Похоже, в адресе почты ошибка";
  }
  for (const field of CONTACT_FIELDS) {
    if (!errors[field] && values[field].length > MAX_LENGTH[field]) {
      errors[field] = `Слишком длинно: не больше ${MAX_LENGTH[field]} символов`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, values, errors };
  }

  return {
    ok: true,
    data: {
      name: values.name,
      about: values.about || null,
      howWeMet: values.howWeMet || null,
      phone: values.phone || null,
      email: values.email || null,
    },
  };
}
