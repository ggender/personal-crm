import "server-only";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { contacts, groupMembers, groups, RU_COLLATION } from "@/db/schema";

const byName = sql`${groups.name} collate ${sql.identifier(RU_COLLATION)}`;
const sameName = (name: string) => sql`lower(${groups.name}) = lower(${name})`;

/** Postgres error 23505: the unique index on lower(name) refused a second group with this name. */
function isUniqueViolation(error: unknown) {
  // Drizzle wraps the driver error: the Postgres code is on the cause.
  const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
  return (cause ?? (error as { code?: string } | undefined))?.code === "23505";
}

/** All groups in alphabetical order, each with the number of contacts in it. */
export async function listGroups() {
  await connection();
  return getDb()
    .select({
      id: groups.id,
      name: groups.name,
      contactCount: sql<number>`count(${groupMembers.contactId})`.mapWith(Number),
    })
    .from(groups)
    .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(byName, asc(groups.id));
}

/** Ids of the groups this contact is in. */
export async function getContactGroupIds(contactId: number) {
  await connection();
  const rows = await getDb()
    .select({ id: groups.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.contactId, contactId))
    .orderBy(byName, asc(groups.id));
  return rows.map((row) => row.id);
}

/** The name of the existing group that `name` repeats, ignoring letter case; null if none. */
async function findDuplicate(name: string, exceptGroupId?: number) {
  const conditions = [sameName(name)];
  if (exceptGroupId !== undefined) conditions.push(ne(groups.id, exceptGroupId));
  const [existing] = await getDb()
    .select({ name: groups.name })
    .from(groups)
    .where(and(...conditions));
  return existing?.name ?? null;
}

export type CreateGroupResult = { id: number } | { duplicateOf: string };

/**
 * Creates a group. When one with the same name (any letter case) exists, creates nothing and
 * returns that group's name. The unique index decides, so two simultaneous requests cannot both win.
 */
export async function createGroup(name: string): Promise<CreateGroupResult> {
  const [created] = await getDb()
    .insert(groups)
    .values({ name })
    .onConflictDoNothing()
    .returning({ id: groups.id });
  if (created) return { id: created.id };

  const duplicateOf = await findDuplicate(name);
  if (duplicateOf === null) throw new Error("Group name conflicted, but no such group was found");
  return { duplicateOf };
}

export type RenameGroupResult = "ok" | "not-found" | { duplicateOf: string };

export async function renameGroup(groupId: number, name: string): Promise<RenameGroupResult> {
  try {
    const updated = await getDb()
      .update(groups)
      .set({ name })
      .where(eq(groups.id, groupId))
      .returning({ id: groups.id });
    return updated.length > 0 ? "ok" : "not-found";
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const duplicateOf = await findDuplicate(name, groupId);
    if (duplicateOf === null) throw error;
    return { duplicateOf };
  }
}

/** Deletes the group; its members stay in the contacts. Returns false when it does not exist. */
export async function deleteGroup(groupId: number) {
  const deleted = await getDb()
    .delete(groups)
    .where(eq(groups.id, groupId))
    .returning({ id: groups.id });
  return deleted.length > 0;
}

export type SetContactGroupResult = "ok" | "contact-not-found" | "group-not-found";

/**
 * Puts the contact into the group or takes it out. Doing it twice changes nothing, so a repeated
 * press (another tab, a double tap) is harmless. Marks the contact as changed, like a new
 * keep-in-touch frequency does.
 */
export async function setContactGroup(
  contactId: number,
  groupId: number,
  member: boolean,
): Promise<SetContactGroupResult> {
  return getDb().transaction(async (tx) => {
    const [group] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId));
    if (!group) return "group-not-found";

    const touched = await tx
      .update(contacts)
      .set({ updatedAt: sql`now()` })
      .where(eq(contacts.id, contactId))
      .returning({ id: contacts.id });
    if (touched.length === 0) return "contact-not-found";

    if (member) {
      await tx.insert(groupMembers).values({ groupId, contactId }).onConflictDoNothing();
    } else {
      await tx
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.contactId, contactId)));
    }
    return "ok";
  });
}

/**
 * Puts the contact into the group with this name, creating the group first when there is none
 * (letter case is ignored). Returns null when the contact does not exist.
 */
export async function addContactToNewGroup(contactId: number, name: string) {
  return getDb().transaction(async (tx) => {
    const touched = await tx
      .update(contacts)
      .set({ updatedAt: sql`now()` })
      .where(eq(contacts.id, contactId))
      .returning({ id: contacts.id });
    if (touched.length === 0) return null;

    const [created] = await tx
      .insert(groups)
      .values({ name })
      .onConflictDoNothing()
      .returning({ id: groups.id });
    let groupId = created?.id;
    if (groupId === undefined) {
      const [existing] = await tx.select({ id: groups.id }).from(groups).where(sameName(name));
      if (!existing) throw new Error("Group name conflicted, but no such group was found");
      groupId = existing.id;
    }

    await tx.insert(groupMembers).values({ groupId, contactId }).onConflictDoNothing();
    return { groupId };
  });
}
