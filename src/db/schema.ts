import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Relative import: drizzle-kit does not resolve the "@/" alias.
import { CONTACT_FREQUENCIES } from "../lib/keep-in-touch";

// Russian alphabetical order (the default collation in the Alpine image sorts by code point).
export const RU_COLLATION = "ru-x-icu";

export const contacts = pgTable(
  "contacts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    // Who this person is: role, relation, what they do
    about: text(),
    // Where and how we met
    howWeMet: text("how_we_met"),
    phone: text(),
    email: text(),
    // How often to keep in touch; NULL means "Не задано"
    contactFrequency: text("contact_frequency", { enum: CONTACT_FREQUENCIES }),
    // Last time "Пообщались" was pressed; NULL means never
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contacts_name_idx").on(sql`${t.name} collate "ru-x-icu"`),
    check(
      "contacts_contact_frequency_check",
      sql`${t.contactFrequency} in (${sql.raw(CONTACT_FREQUENCIES.map((value) => `'${value}'`).join(", "))})`,
    ),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_contact_id_created_at_idx").on(t.contactId, t.createdAt)],
);

export const groups = pgTable(
  "groups",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Names are unique regardless of letter case: "Теннис" and "теннис" are the same group.
    uniqueIndex("groups_name_lower_idx").on(sql`lower(${t.name})`),
    check("groups_name_length_check", sql`char_length(${t.name}) between 1 and 50`),
  ],
);

// Which contact is in which group. Deleting either side removes only the link.
export const groupMembers = pgTable(
  "group_members",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.contactId] }),
    index("group_members_contact_id_idx").on(t.contactId),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type Group = typeof groups.$inferSelect;
