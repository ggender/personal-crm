"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import {
  addNote,
  createContact,
  deleteContact,
  deleteNote,
  updateContact,
  updateNote,
} from "@/lib/contacts";
import {
  contactInputSchema,
  type ContactField,
  contactUpdateSchema,
  noteInputSchema,
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

const contactFields: ContactField[] = ["name", "about", "howWeMet", "phone", "email", "firstNote"];
const contactUpdateFields: ContactField[] = ["name", "about", "howWeMet", "phone", "email"];

const isValidId = (id: number) => Number.isSafeInteger(id) && id > 0;

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
    if (!saved) return { message: "Контакт не найден — возможно, его уже удалили.", values };
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

  let name: string | null;
  try {
    name = await deleteContact(contactId);
  } catch (error) {
    console.error("Failed to delete contact", error);
    return { error: "Не удалось удалить контакт. Попробуйте ещё раз." };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  // Already gone (e.g. deleted in another tab): the goal is reached, return to the list anyway.
  redirect(name ? `/?deleted=${encodeURIComponent(name)}` : "/");
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
    if (!saved) return { error: "Заметка не найдена — возможно, её уже удалили.", body };
  } catch (error) {
    console.error("Failed to update note", error);
    return { error: "Не удалось сохранить заметку. Попробуйте ещё раз.", body };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { savedAt: Date.now() };
}

export async function deleteNoteAction(contactId: number, noteId: number): Promise<DeleteResult> {
  if (!isValidId(contactId) || !isValidId(noteId)) {
    return { error: "Заметка не найдена" };
  }

  try {
    // A note that is already gone counts as deleted.
    await deleteNote(contactId, noteId);
  } catch (error) {
    console.error("Failed to delete note", error);
    return { error: "Не удалось удалить заметку. Попробуйте ещё раз." };
  }

  revalidatePath(`/contacts/${contactId}`);
  return {};
}
