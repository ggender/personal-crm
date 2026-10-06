import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contacts_name_idx").on(sql`${t.name} collate "ru-x-icu"`)],
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

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
