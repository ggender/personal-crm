// Shared by the database schema, server actions and client components. No server-only imports, and
// no zod either: it would add the whole library to the browser bundle (schemas: src/lib/validation.ts).

export const CONTACT_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export type ContactFrequency = (typeof CONTACT_FREQUENCIES)[number];

export const CONTACT_FREQUENCY_LABELS: Record<ContactFrequency, string> = {
  weekly: "Раз в неделю",
  monthly: "Раз в месяц",
  quarterly: "Раз в квартал",
  yearly: "Раз в год",
};

export const NO_FREQUENCY_LABEL = "Не задано";

/** Days, due dates and overdue counts follow the owner's calendar, not the server's. */
export const APP_TIME_ZONE = "Europe/Moscow";

/** How long "Отменить" stays on screen after "Пообщались". */
export const UNDO_WINDOW_MS = 5000;
