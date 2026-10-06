"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { addNote, createContact } from "@/lib/contacts";
import { contactInputSchema, type ContactField, noteInputSchema } from "@/lib/validation";

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

const contactFields: ContactField[] = ["name", "about", "howWeMet", "phone", "email", "firstNote"];

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
  const values = Object.fromEntries(
    contactFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as Record<ContactField, string>;

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
  if (!Number.isSafeInteger(contactId) || contactId <= 0) {
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
