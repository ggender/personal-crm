import "server-only";

import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

// Lowercases and treats "ё" as "е", so "Алена" finds "Алёна".
function normalizeForSearch(value: string): string {
  return value.toLowerCase().replaceAll("ё", "е");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Every word of the query must appear in the name: "иван пет" finds "Иван Петров".
function nameMatches(query: string): SQL | undefined {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;
  const normalizedName = sql`replace(lower(${contacts.name}), 'ё', 'е')`;
  return and(
    ...words.map((word) => sql`${normalizedName} like ${`%${escapeLike(word)}%`}`),
  );
}

export async function listContacts(query: string) {
  await connection();
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      howWeMet: contacts.howWeMet,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(nameMatches(query))
    .orderBy(sql`${contacts.name} collate "ru-x-icu"`, asc(contacts.id));
}

export async function countContacts(): Promise<number> {
  await connection();
  const [{ value }] = await db.select({ value: count() }).from(contacts);
  return value;
}

// Wrapped in cache() so the page and its metadata share one query per request.
export const getContact = cache(async (id: number) => {
  await connection();
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id));
  return contact ?? null;
});

export async function getContactNotes(contactId: number) {
  await connection();
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

// Route params arrive as strings; anything but a positive integer is not a contact id.
export function parseContactId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}
