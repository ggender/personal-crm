import "server-only";

import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { contacts, notes, RU_COLLATION } from "@/db/schema";
import type { ContactInput } from "@/lib/validation";

// Case- and "ё"-insensitive form used for name search.
const normalizeForSearch = (value: string) => value.toLowerCase().replaceAll("ё", "е");
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export async function listContacts(query: string) {
  await connection();
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  // Every word must appear in the name, in any order: "петров иван" finds "Иван Петров".
  const conditions = words.map(
    (word) => sql`replace(lower(${contacts.name}), 'ё', 'е') like ${`%${escapeLike(word)}%`}`,
  );

  return getDb()
    .select({ id: contacts.id, name: contacts.name, about: contacts.about, phone: contacts.phone })
    .from(contacts)
    .where(and(...conditions))
    .orderBy(sql`${contacts.name} collate ${sql.identifier(RU_COLLATION)}`, asc(contacts.id));
}

export async function countContacts() {
  await connection();
  const [{ value }] = await getDb().select({ value: count() }).from(contacts);
  return value;
}

export async function getContact(id: number) {
  await connection();
  const [contact] = await getDb().select().from(contacts).where(eq(contacts.id, id));
  return contact ?? null;
}

export async function listNotes(contactId: number) {
  await connection();
  return getDb()
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}

export async function createContact({ firstNote, ...fields }: ContactInput) {
  return getDb().transaction(async (tx) => {
    const [{ id }] = await tx.insert(contacts).values(fields).returning({ id: contacts.id });
    if (firstNote) {
      await tx.insert(notes).values({ contactId: id, body: firstNote });
    }
    return id;
  });
}

/** Returns false when the contact does not exist. */
export async function addNote(contactId: number, body: string) {
  return getDb().transaction(async (tx) => {
    const updated = await tx
      .update(contacts)
      .set({ updatedAt: sql`now()` })
      .where(eq(contacts.id, contactId))
      .returning({ id: contacts.id });
    if (updated.length === 0) return false;
    await tx.insert(notes).values({ contactId, body });
    return true;
  });
}
