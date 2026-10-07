"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  addNote,
  createContact,
  deleteContact,
  markContacted,
  setContactFrequency,
  undoContacted,
  updateContact,
  updateNote,
} from "@/lib/contacts";
import type { ContactFrequency } from "@/lib/keep-in-touch";
import {
  contactFrequencySchema,
  contactInputSchema,
  type ContactField,
  contactUpdateSchema,
  noteInputSchema,
  undoContactedSchema,
} from "@/lib/validation";

export type ContactFormState = {
  errors?: Partial<Record<ContactField, string>>;
  message?: string;
  values?: Partial<Record<ContactField, string>>;
};

export type NoteFormState = {
  error?: string;
  body?: string;
  savedAt?: number;
};

export type DeleteResult = {
  error?: string;
};

export type SaveResult = {
  error?: string;
};

/** On success: what undo needs, as ISO strings. */
export type MarkContactedResult = { previous: string | null; marked: string } | { error: string };

const contactFields: ContactField[] = ["name", "about", "howWeMet", "phone", "email", "firstNote"];
const contactUpdateFields: ContactField[] = ["name", "about", "howWeMet", "phone", "email"];

const isValidId = (id: number) => Number.isSafeInteger(id) && id > 0;

const NOT_FOUND = "Контакт не найден";
const SAVE_FAILED = "Не удалось сохранить. Попробуйте ещё раз.";

function readFields(formData: FormData, fields: ContactField[]) {
  return Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as Record<ContactField, string>;
}

function firstErrors(error: z.ZodError) {
  const errors: Partial<Record<ContactField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ContactField;
    errors[field] ??= issue.message;
  }
  return errors;
}

export async function createContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readFields(formData, contactFields);

  const parsed = contactInputSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: firstErrors(parsed.error), values };
  }

  let id: number;
  try {
    id = await createContact(parsed.data);
  } catch (error) {
    console.error("Failed to create contact", error);
    return { message: "Не удалось сохранить контакт. Попробуйте ещё раз.", values };
  }

  revalidatePath("/");
  redirect(`/?added=${id}`);
}

export async function updateContactAction(
  contactId: number,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readFields(formData, contactUpdateFields);
  if (!isValidId(contactId)) {
    return { message: "Контакт не найден", values };
  }

  const parsed = contactUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: firstErrors(parsed.error), values };
  }

  try {
    const saved = await updateContact(contactId, parsed.data);
    if (!saved) return { message: "Контакт не найден", values };
  } catch (error) {
    console.error("Failed to update contact", error);
    return { message: "Не удалось сохранить изменения. Попробуйте ещё раз.", values };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}`);
}

export async function deleteContactAction(contactId: number): Promise<DeleteResult> {
  if (!isValidId(contactId)) {
    return { error: "Контакт не найден" };
  }

  try {
    await deleteContact(contactId);
  } catch (error) {
    console.error("Failed to delete contact", error);
    return { error: "Не удалось удалить контакт. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  // Already gone (e.g. deleted in another tab) is fine too: the goal is reached, return to the list.
  redirect("/");
}

export async function addNoteAction(
  contactId: number,
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const body = String(formData.get("body") ?? "");
  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, body };
  }
  if (!isValidId(contactId)) {
    return { error: "Контакт не найден", body };
  }

  try {
    const saved = await addNote(contactId, parsed.data.body);
    if (!saved) return { error: "Контакт не найден", body };
  } catch (error) {
    console.error("Failed to add note", error);
    return { error: "Не удалось сохранить заметку. Попробуйте ещё раз.", body };
  }

  // A new note restarts the keep-in-touch period, so the home page block changes too.
  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  return { savedAt: Date.now() };
}

export async function updateNoteAction(
  contactId: number,
  noteId: number,
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const body = String(formData.get("body") ?? "");
  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, body };
  }
  if (!isValidId(contactId) || !isValidId(noteId)) {
    return { error: "Заметка не найдена", body };
  }

  try {
    const saved = await updateNote(contactId, noteId, parsed.data.body);
    if (!saved) return { error: "Заметка не найдена", body };
  } catch (error) {
    console.error("Failed to update note", error);
    return { error: "Не удалось сохранить заметку. Попробуйте ещё раз.", body };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { savedAt: Date.now() };
}

export async function setContactFrequencyAction(
  contactId: number,
  frequency: ContactFrequency | null,
): Promise<SaveResult> {
  const parsed = contactFrequencySchema.safeParse(frequency);
  if (!parsed.success) return { error: SAVE_FAILED };
  if (!isValidId(contactId)) return { error: NOT_FOUND };

  try {
    const saved = await setContactFrequency(contactId, parsed.data);
    if (!saved) return { error: NOT_FOUND };
  } catch (error) {
    console.error("Failed to set contact frequency", error);
    return { error: SAVE_FAILED };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  return {};
}

/*
 * "Пообщались" and its undo do not revalidate: the home page would re-render at once and drop the
 * row before "Отменить" could be pressed. The button refreshes the page itself (see ContactedButton).
 */

export async function markContactedAction(contactId: number): Promise<MarkContactedResult> {
  if (!isValidId(contactId)) return { error: NOT_FOUND };

  try {
    const result = await markContacted(contactId);
    if (!result) return { error: NOT_FOUND };
    return {
      previous: result.previous?.toISOString() ?? null,
      marked: result.marked.toISOString(),
    };
  } catch (error) {
    console.error("Failed to mark contact as contacted", error);
    return { error: SAVE_FAILED };
  }
}

export async function undoContactedAction(
  contactId: number,
  previous: string | null,
  marked: string,
): Promise<SaveResult> {
  const parsed = undoContactedSchema.safeParse({ previous, marked });
  if (!parsed.success) return { error: SAVE_FAILED };
  if (!isValidId(contactId)) return { error: NOT_FOUND };

  try {
    // Nothing restored means a later press replaced this mark: it stays, and that is not an error.
    await undoContacted(
      contactId,
      parsed.data.previous === null ? null : new Date(parsed.data.previous),
      new Date(parsed.data.marked),
    );
  } catch (error) {
    console.error("Failed to undo contacted mark", error);
    return { error: SAVE_FAILED };
  }
  return {};
}
