import "server-only";

import { and, asc, count, desc, eq, gt, isNotNull, type SQL, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { contacts, groupMembers, groups, notes, RU_COLLATION } from "@/db/schema";
import { APP_TIME_ZONE, CONTACT_FREQUENCIES, type ContactFrequency } from "@/lib/keep-in-touch";
import type { ContactInput, ContactUpdate } from "@/lib/validation";

// Case- and "ё"-insensitive form used for name search.
const normalizeForSearch = (value: string) => value.toLowerCase().replaceAll("ё", "е");
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const byName = sql`${contacts.name} collate ${sql.identifier(RU_COLLATION)}`;

/*
 * Keep in touch: one set of expressions for the home page block and the contact card.
 * Last contact = the later of the newest note and the last "Пообщались", else the day the contact
 * was added. Editing a note keeps its created_at, so it does not reset the due date.
 * Days are Moscow calendar days; Postgres adds calendar months and clamps to the month's end
 * (31 January + 1 month = 28 February). A contact is overdue from the day after the due date.
 */
const FREQUENCY_INTERVALS: Record<ContactFrequency, string> = {
  weekly: "7 days",
  monthly: "1 month",
  quarterly: "3 months",
  yearly: "1 year",
};

const lastNoteAt = sql`(select max(${notes.createdAt}) from ${notes} where ${notes.contactId} = ${contacts.id})`;
const lastContactAt = sql`coalesce(greatest(${lastNoteAt}, ${contacts.lastContactedAt}), ${contacts.createdAt})`;
const frequencyInterval = sql`case ${contacts.contactFrequency} ${sql.join(
  CONTACT_FREQUENCIES.map(
    (frequency) => sql`when ${frequency} then ${FREQUENCY_INTERVALS[frequency]}::interval`,
  ),
  sql` `,
)} end`;
// NULL when the frequency is not set.
const dueDate = sql`((${lastContactAt} at time zone ${APP_TIME_ZONE})::date + ${frequencyInterval})::date`;
const today = sql`(now() at time zone ${APP_TIME_ZONE})::date`;
const overdueDays = sql<number | null>`(${today} - ${dueDate})`.mapWith(Number);

/** Which part of the list the home page shows: everyone, one group, or people without a group. */
export type GroupFilter = { kind: "all" } | { kind: "group"; groupId: number } | { kind: "none" };

const isMemberOf = (condition?: SQL) => sql`exists (
  select 1 from ${groupMembers}
  where ${groupMembers.contactId} = ${contacts.id}${condition ? sql` and ${condition}` : sql``}
)`;

/** The SQL condition for a filter; undefined for "all". */
function groupCondition(filter: GroupFilter) {
  if (filter.kind === "group") return isMemberOf(eq(groupMembers.groupId, filter.groupId));
  if (filter.kind === "none") return sql`not ${isMemberOf()}`;
  return undefined;
}

// Names of the contact's groups in alphabetical order, one subquery for the whole list.
// Kept as a separate SQL object: Drizzle strips table names from the columns that sit directly in
// a single-table select field, and "id" would then mean groups.id instead of contacts.id.
const groupLabelsQuery = sql`array(
  select ${groups.name} from ${groupMembers}
  inner join ${groups} on ${groups.id} = ${groupMembers.groupId}
  where ${groupMembers.contactId} = ${contacts.id}
  order by ${groups.name} collate ${sql.identifier(RU_COLLATION)}, ${groups.id}
)`;
const groupLabels = sql<string[]>`${groupLabelsQuery}`;

export async function listContacts(query: string, filter: GroupFilter) {
  await connection();
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  // Every word must appear in the name, in any order: "петров иван" finds "Иван Петров".
  const conditions = words.map(
    (word) => sql`replace(lower(${contacts.name}), 'ё', 'е') like ${`%${escapeLike(word)}%`}`,
  );

  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      groups: groupLabels,
    })
    .from(contacts)
    .where(and(...conditions, groupCondition(filter)))
    .orderBy(byName, asc(contacts.id));
}

/** Contacts not reached for longer than their frequency: the most overdue first, then by name. */
export async function listOverdueContacts() {
  await connection();
  return getDb()
    .select({
      id: contacts.id,
      name: contacts.name,
      frequency: sql<ContactFrequency>`${contacts.contactFrequency}`,
      overdueDays: sql<number>`${overdueDays}`.mapWith(Number),
    })
    .from(contacts)
    .where(and(isNotNull(contacts.contactFrequency), gt(overdueDays, 0)))
    .orderBy(desc(overdueDays), byName, asc(contacts.id));
}

export type ContactTouchStatus =
  | { frequency: null }
  | {
      frequency: ContactFrequency;
      /** The last day to get in touch, "YYYY-MM-DD" (a text, so no time zone can shift the day). */
      dueDate: string;
      /** Days past the due date; zero or less means not overdue yet. */
      overdueDays: number;
    };

/** Returns null when the contact does not exist. */
export async function getContactTouchStatus(contactId: number): Promise<ContactTouchStatus | null> {
  await connection();
  const [row] = await getDb()
    .select({
      frequency: contacts.contactFrequency,
      dueDate: sql<string | null>`to_char(${dueDate}, 'YYYY-MM-DD')`,
      overdueDays,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId));
  if (!row) return null;
  if (!row.frequency || row.dueDate === null || row.overdueDays === null)
    return { frequency: null };
  return { frequency: row.frequency, dueDate: row.dueDate, overdueDays: row.overdueDays };
}

export async function countContacts(filter: GroupFilter) {
  await connection();
  const [{ value }] = await getDb()
    .select({ value: count() })
    .from(contacts)
    .where(groupCondition(filter));
  return value;
}

export async function getContact(id: number) {
  await connection();
  const [contact] = await getDb().select().from(contacts).where(eq(contacts.id, id));
  return contact ?? null;
}

export async function countNotes(contactId: number) {
  await connection();
  const [{ value }] = await getDb()
    .select({ value: count() })
    .from(notes)
    .where(eq(notes.contactId, contactId));
  return value;
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

/** Returns false when the contact does not exist. */
export async function updateContact(id: number, fields: ContactUpdate) {
  const updated = await getDb()
    .update(contacts)
    .set({ ...fields, updatedAt: sql`now()` })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return updated.length > 0;
}

/**
 * Deletes the contact together with its notes (the foreign key cascades).
 * Returns false when the contact does not exist.
 */
export async function deleteContact(id: number) {
  const deleted = await getDb()
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  return deleted.length > 0;
}

/** Returns false when the contact does not exist. */
export async function setContactFrequency(contactId: number, frequency: ContactFrequency | null) {
  const updated = await getDb()
    .update(contacts)
    .set({ contactFrequency: frequency, updatedAt: sql`now()` })
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id });
  return updated.length > 0;
}

/**
 * "Пообщались": records a contact now, without a note. Leaves updated_at alone: the contact's
 * data did not change. Returns the previous and the new mark for undo, or null when the contact
 * does not exist.
 */
export async function markContacted(contactId: number) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ lastContactedAt: contacts.lastContactedAt })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .for("update");
    if (!current) return null;
    // Millisecond precision, so the mark survives the round trip through a JS Date for undo.
    const [{ marked }] = await tx
      .update(contacts)
      .set({ lastContactedAt: sql`date_trunc('milliseconds', now())` })
      .where(eq(contacts.id, contactId))
      .returning({ marked: contacts.lastContactedAt });
    return { previous: current.lastContactedAt, marked: marked! };
  });
}

/**
 * Restores the mark that was there before "Пообщались", but only while the contact still has the
 * mark that press set: a later press, e.g. in another tab, is not overwritten.
 * Returns false when nothing was restored.
 */
export async function undoContacted(contactId: number, previous: Date | null, marked: Date) {
  const updated = await getDb()
    .update(contacts)
    .set({ lastContactedAt: previous })
    .where(and(eq(contacts.id, contactId), eq(contacts.lastContactedAt, marked)))
    .returning({ id: contacts.id });
  return updated.length > 0;
}

/** Returns false when the note does not exist or belongs to another contact. */
export async function updateNote(contactId: number, noteId: number, body: string) {
  return getDb().transaction(async (tx) => {
    const updated = await tx
      .update(notes)
      .set({ body })
      .where(and(eq(notes.id, noteId), eq(notes.contactId, contactId)))
      .returning({ id: notes.id });
    if (updated.length === 0) return false;
    await tx
      .update(contacts)
      .set({ updatedAt: sql`now()` })
      .where(eq(contacts.id, contactId));
    return true;
  });
}
