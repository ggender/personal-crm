"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { userForAction } from "@/lib/current-user";
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
import {
  addContactToNewGroup,
  createGroup,
  deleteGroup,
  renameGroup,
  setContactGroup,
} from "@/lib/groups";
import type { ContactFrequency } from "@/lib/keep-in-touch";
import {
  contactFrequencySchema,
  contactInputSchema,
  type ContactField,
  contactUpdateSchema,
  groupNameSchema,
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

export type GroupFormState = {
  error?: string;
  /** The name that was sent, so a failed form keeps it in the field. */
  name?: string;
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

const contactUpdateFields: ContactField[] = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "birthDay",
  "birthMonth",
  "birthYear",
];
const contactFields: ContactField[] = [...contactUpdateFields, "firstNote"];

const isValidId = (id: number) => Number.isSafeInteger(id) && id > 0;

const NOT_FOUND = "Контакт не найден";
const GROUP_NOT_FOUND = "Группа не найдена";
const SAVE_FAILED = "Не удалось сохранить. Попробуйте ещё раз.";

const groupDuplicateMessage = (existingName: string) => `Группа «${existingName}» уже есть`;

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
  // Not logged in: the login page opens. The login could not be checked: the same answer as for any
  // other database failure.
  const user = await userForAction();
  const values = readFields(formData, contactFields);
  if (!user) return { message: "Не удалось сохранить контакт. Попробуйте ещё раз.", values };

  const parsed = contactInputSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: firstErrors(parsed.error), values };
  }

  let id: number;
  try {
    id = await createContact(user.id, parsed.data);
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
  const user = await userForAction();
  const values = readFields(formData, contactUpdateFields);
  if (!user) return { message: "Не удалось сохранить изменения. Попробуйте ещё раз.", values };
  if (!isValidId(contactId)) {
    return { message: "Контакт не найден", values };
  }

  const parsed = contactUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: firstErrors(parsed.error), values };
  }

  try {
    const saved = await updateContact(user.id, contactId, parsed.data);
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
  const user = await userForAction();
  if (!user) return { error: "Не удалось удалить контакт. Попробуйте ещё раз." };
  if (!isValidId(contactId)) {
    return { error: "Контакт не найден" };
  }

  try {
    await deleteContact(user.id, contactId);
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
  const user = await userForAction();
  const body = String(formData.get("body") ?? "");
  if (!user) return { error: "Не удалось сохранить заметку. Попробуйте ещё раз.", body };
  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, body };
  }
  if (!isValidId(contactId)) {
    return { error: "Контакт не найден", body };
  }

  try {
    const saved = await addNote(user.id, contactId, parsed.data.body);
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
  const user = await userForAction();
  const body = String(formData.get("body") ?? "");
  if (!user) return { error: "Не удалось сохранить заметку. Попробуйте ещё раз.", body };
  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, body };
  }
  if (!isValidId(contactId) || !isValidId(noteId)) {
    return { error: "Заметка не найдена", body };
  }

  try {
    const saved = await updateNote(user.id, contactId, noteId, parsed.data.body);
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
  const user = await userForAction();
  if (!user) return { error: SAVE_FAILED };
  const parsed = contactFrequencySchema.safeParse(frequency);
  if (!parsed.success) return { error: SAVE_FAILED };
  if (!isValidId(contactId)) return { error: NOT_FOUND };

  try {
    const saved = await setContactFrequency(user.id, contactId, parsed.data);
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
  const user = await userForAction();
  if (!user) return { error: SAVE_FAILED };
  if (!isValidId(contactId)) return { error: NOT_FOUND };

  try {
    const result = await markContacted(user.id, contactId);
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
  const user = await userForAction();
  if (!user) return { error: SAVE_FAILED };
  const parsed = undoContactedSchema.safeParse({ previous, marked });
  if (!parsed.success) return { error: SAVE_FAILED };
  if (!isValidId(contactId)) return { error: NOT_FOUND };

  try {
    // Nothing restored means a later press replaced this mark: it stays, and that is not an error.
    await undoContacted(
      user.id,
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

export async function createGroupAction(
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await userForAction();
  const name = String(formData.get("name") ?? "");
  if (!user) return { error: SAVE_FAILED, name };
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, name };

  try {
    const result = await createGroup(user.id, parsed.data);
    if ("duplicateOf" in result) return { error: groupDuplicateMessage(result.duplicateOf), name };
  } catch (error) {
    console.error("Failed to create group", error);
    return { error: SAVE_FAILED, name };
  }

  // The group name is shown on every page: the filter, the contact pages and the list labels.
  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

export async function renameGroupAction(
  groupId: number,
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await userForAction();
  const name = String(formData.get("name") ?? "");
  if (!user) return { error: SAVE_FAILED, name };
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, name };
  if (!isValidId(groupId)) return { error: GROUP_NOT_FOUND, name };

  try {
    const result = await renameGroup(user.id, groupId, parsed.data);
    if (result === "not-found") return { error: GROUP_NOT_FOUND, name };
    if (result !== "ok") return { error: groupDuplicateMessage(result.duplicateOf), name };
  } catch (error) {
    console.error("Failed to rename group", error);
    return { error: SAVE_FAILED, name };
  }

  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}

export async function deleteGroupAction(groupId: number): Promise<DeleteResult> {
  const user = await userForAction();
  if (!user) return { error: SAVE_FAILED };
  if (!isValidId(groupId)) return { error: GROUP_NOT_FOUND };

  try {
    // A group that is already gone (deleted in another tab) is fine: the goal is reached.
    await deleteGroup(user.id, groupId);
  } catch (error) {
    console.error("Failed to delete group", error);
    return { error: SAVE_FAILED };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function setContactGroupAction(
  contactId: number,
  groupId: number,
  member: boolean,
): Promise<SaveResult> {
  const user = await userForAction();
  if (!user) return { error: SAVE_FAILED };
  if (!isValidId(contactId)) return { error: NOT_FOUND };
  if (!isValidId(groupId)) return { error: GROUP_NOT_FOUND };

  try {
    const result = await setContactGroup(user.id, contactId, groupId, member === true);
    if (result === "contact-not-found") return { error: NOT_FOUND };
    if (result === "group-not-found") return { error: GROUP_NOT_FOUND };
  } catch (error) {
    console.error("Failed to set contact group", error);
    return { error: SAVE_FAILED };
  }

  // The contact page, its labels in the list and the group sizes on the "Группы" page change.
  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/groups");
  return {};
}

export async function createGroupForContactAction(
  contactId: number,
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const user = await userForAction();
  const name = String(formData.get("name") ?? "");
  if (!user) return { error: SAVE_FAILED, name };
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, name };
  if (!isValidId(contactId)) return { error: NOT_FOUND, name };

  try {
    const added = await addContactToNewGroup(user.id, contactId, parsed.data);
    if (!added) return { error: NOT_FOUND, name };
  } catch (error) {
    console.error("Failed to create group for contact", error);
    return { error: SAVE_FAILED, name };
  }

  revalidatePath("/", "layout");
  return { savedAt: Date.now() };
}
