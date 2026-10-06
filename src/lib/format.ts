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

/** Stable soft hue per contact, so avatars are easy to tell apart. */
export const avatarHue = (id: number) => (id * 137) % 360;
