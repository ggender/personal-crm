"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  parseContactForm,
  type ContactField,
  type ContactFormValues,
} from "@/lib/contact-input";

export type ContactFormState = {
  values?: ContactFormValues;
  errors?: Partial<Record<ContactField, string>>;
};

export type NoteFormState = {
  error?: string;
  body?: string;
};

const MAX_NOTE_LENGTH = 10_000;

function assertId(id: unknown): asserts id is number {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    notFound();
  }
}

export async function createContact(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = parseContactForm(formData);
  if (!parsed.ok) {
    return { values: parsed.values, errors: parsed.errors };
  }

  const [created] = await db
    .insert(contacts)
    .values(parsed.data)
    .returning({ id: contacts.id });

  revalidatePath("/");
  redirect(`/?added=${created.id}`);
}

export async function updateContact(
  id: number,
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  assertId(id);
  const parsed = parseContactForm(formData);
  if (!parsed.ok) {
    return { values: parsed.values, errors: parsed.errors };
  }

  const updated = await db
    .update(contacts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });
  if (updated.length === 0) {
    notFound();
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function addNote(
  contactId: number,
  _previous: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  assertId(contactId);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    return { error: "Напишите текст заметки" };
  }
  if (body.length > MAX_NOTE_LENGTH) {
    return {
      error: `Слишком длинная заметка: не больше ${MAX_NOTE_LENGTH} символов`,
      body,
    };
  }

  const saved = await db.transaction(async (tx) => {
    const touched = await tx
      .update(contacts)
      .set({ updatedAt: new Date() })
      .where(eq(contacts.id, contactId))
      .returning({ id: contacts.id });
    if (touched.length === 0) return false;
    await tx.insert(notes).values({ contactId, body });
    return true;
  });
  if (!saved) {
    notFound();
  }

  revalidatePath(`/contacts/${contactId}`);
  return {};
}

// Deletes the contact together with its notes (ON DELETE CASCADE).
export async function deleteContact(id: number): Promise<void> {
  assertId(id);
  await db.delete(contacts).where(eq(contacts.id, id));

  revalidatePath("/");
  redirect("/?deleted=1");
}

export async function deleteNote(contactId: number, noteId: number): Promise<void> {
  assertId(contactId);
  assertId(noteId);
  await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.contactId, contactId)));

  revalidatePath(`/contacts/${contactId}`);
}
