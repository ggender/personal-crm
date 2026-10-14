import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  addNoteAction,
  createGroupForContactAction,
  deleteContactAction,
  deleteGroupAction,
  markContactedAction,
  renameGroupAction,
  setContactFrequencyAction,
  setContactGroupAction,
  undoContactedAction,
  updateContactAction,
  updateNoteAction,
} from "@/app/actions";
import { getDb } from "@/db";
import {
  addNote,
  countContacts,
  countNotes,
  createContact,
  deleteContact,
  getContact,
  getContactTouchStatus,
  type GroupFilter,
  listContacts,
  listNotes,
  listOverdueContacts,
  markContacted,
  setContactFrequency,
  undoContacted,
  updateContact,
  updateNote,
} from "@/lib/contacts";
import { resolveGroupFilter } from "@/lib/group-filter";
import {
  addContactToNewGroup,
  deleteGroup,
  getContactGroupIds,
  listGroups,
  renameGroup,
  setContactGroup,
} from "@/lib/groups";
import { contactInputSchema } from "@/lib/validation";

import {
  addMember,
  closeDb,
  makeContact,
  makeContacts,
  makeGroup,
  makeNote,
  makeUser,
  resetDb,
} from "./helpers/db";
import { daysAgo } from "./helpers/days";
import { signInAs } from "./shims/current-user";

/*
 * openspec/specs/data-ownership/spec.md: every function that reads or changes data takes the user
 * and works only with that user's records. User A has data; user B asks for it by its numbers,
 * the way someone who guesses an address or sends a request of his own would.
 * The scenarios that need a browser are in e2e/data-ownership.spec.ts; the migration that gives
 * the old data to the owner is tested in tests/data-owner-migration.test.ts and seed.test.ts.
 */

const ALL: GroupFilter = { kind: "all" };
const MISSING = 999_999;

let a: Awaited<ReturnType<typeof makeUser>>;
let b: Awaited<ReturnType<typeof makeUser>>;

beforeEach(async () => {
  await resetDb();
  a = await makeUser("a@example.test");
  b = await makeUser("b@example.test");
  signInAs(b.id);
});
afterAll(closeDb);

const form = (fields: Record<string, string>) => {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
};

const names = async (userId: string, query = "") =>
  (await listContacts(userId, query, ALL)).map((contact) => contact.name);

/** What user A has, as stored: it must be the same after everything B tries. */
async function storedFor(userId: string) {
  const db = getDb();
  return {
    contacts: await db.execute(sql`select * from contacts where user_id = ${userId} order by id`),
    notes: await db.execute(sql`
      select n.* from notes n join contacts c on c.id = n.contact_id
      where c.user_id = ${userId} order by n.id`),
    groups: await db.execute(sql`select * from groups where user_id = ${userId} order by id`),
    members: await db.execute(sql`
      select m.* from group_members m join groups g on g.id = m.group_id
      where g.user_id = ${userId} order by m.group_id, m.contact_id`),
  };
}

/** A with a contact that has a note, a keep-in-touch period, and a group of its own. */
async function userAWithData() {
  const contact = await makeContact(a.id, {
    name: "Вера Кузнецова",
    about: "Соседка",
    phone: "+7 900 123-45-67",
    contactFrequency: "weekly",
    createdAt: daysAgo(30),
  });
  const note = await makeNote(contact.id, daysAgo(20), "Договорились созвониться");
  const group = await makeGroup(a.id, "Теннис");
  await addMember(group, contact.id);
  return { contact, note, groupId: group };
}

describe("У каждой записи есть владелец", () => {
  it("Новый контакт у того, кто его добавил", async () => {
    const id = await createContact(
      a.id,
      contactInputSchema.parse({
        name: "Вера Кузнецова",
        about: "",
        howWeMet: "",
        phone: "",
        email: "",
        firstNote: "Договорились созвониться",
      }),
    );

    expect(await names(a.id)).toEqual(["Вера Кузнецова"]);
    expect((await listNotes(a.id, id)).map((note) => note.body)).toEqual([
      "Договорились созвониться",
    ]);
    expect(await names(b.id)).toEqual([]);
    expect(await getContact(b.id, id)).toBeNull();
  });
});

describe("Пользователь видит только своё", () => {
  it("Чужого контакта нет в списке и поиске", async () => {
    await makeContact(a.id, { name: "Вера Кузнецова" });
    await makeContacts(b.id, ["Анна Смирнова", "Борис Орлов"]);

    expect(await names(b.id)).toEqual(["Анна Смирнова", "Борис Орлов"]);
    expect(await names(b.id, "Кузнецова")).toEqual([]);
    expect(await countContacts(b.id, ALL)).toBe(2);
    expect(await countContacts(a.id, ALL)).toBe(1);
  });

  it("Чужие просроченные не попадают в «Пора связаться»", async () => {
    await userAWithData();
    expect((await listOverdueContacts(a.id)).map((contact) => contact.name)).toEqual([
      "Вера Кузнецова",
    ]);

    expect(await listOverdueContacts(b.id)).toEqual([]);
  });

  it("Чужих групп не видно", async () => {
    const { contact } = await userAWithData();
    const own = await makeContact(b.id, { name: "Анна Смирнова" });

    expect(await listGroups(b.id)).toEqual([]);
    expect((await listContacts(b.id, "", ALL)).map((item) => item.groups)).toEqual([[]]);
    expect(await getContactGroupIds(b.id, own.id)).toEqual([]);
    // Even the groups of A's contact are not shown to B, who asks for that contact by number.
    expect(await getContactGroupIds(b.id, contact.id)).toEqual([]);
    expect((await listGroups(a.id)).map((group) => group.name)).toEqual(["Теннис"]);
  });
});

describe("Чужое не открывается по прямой ссылке", () => {
  it("Чужой контакт по прямой ссылке", async () => {
    const { contact } = await userAWithData();

    // What the contact page asks for: nothing of A's contact is returned.
    expect(await getContact(b.id, contact.id)).toBeNull();
    expect(await getContactTouchStatus(b.id, contact.id)).toBeNull();
    expect(await listNotes(b.id, contact.id)).toEqual([]);
    expect(await countNotes(b.id, contact.id)).toBe(0);
    expect(await getContactGroupIds(b.id, contact.id)).toEqual([]);
    // For A the same calls show everything.
    expect((await getContact(a.id, contact.id))?.name).toBe("Вера Кузнецова");
  });

  it("Правка чужого контакта по прямой ссылке", async () => {
    const { contact } = await userAWithData();

    // What the edit page asks for: no contact, so no form with its data.
    expect(await getContact(b.id, contact.id)).toBeNull();
    expect(await countNotes(b.id, contact.id)).toBe(0);
  });

  it("Чужая группа в ссылке", async () => {
    const { groupId } = await userAWithData();
    await makeContacts(b.id, ["Анна Смирнова", "Борис Орлов"]);

    const filter = resolveGroupFilter(String(groupId), await listGroups(b.id));

    expect(filter).toEqual(ALL);
    expect(await names(b.id)).toEqual(["Анна Смирнова", "Борис Орлов"]);
    // Even asked for directly, the filter finds nothing of A's.
    expect(await listContacts(b.id, "", { kind: "group", groupId })).toEqual([]);
  });
});

describe("Чужое не меняется запросом к серверу", () => {
  /** The answer of a server action; a redirect (the action's "done") counts as an answer too. */
  async function outcome(run: () => Promise<unknown>) {
    try {
      return await run();
    } catch (error) {
      const digest = (error as { digest?: string }).digest;
      if (!digest?.startsWith("NEXT_REDIRECT")) throw error;
      return { redirectedTo: digest };
    }
  }

  /** B sends every kind of change for the given numbers; returns what B gets back. */
  const attempts = (contactId: number, noteId: number, groupId: number) => [
    () => updateContactAction(contactId, {}, form({ name: "Взломано" })),
    () => deleteContactAction(contactId),
    () => addNoteAction(contactId, {}, form({ body: "Взломано" })),
    () => updateNoteAction(contactId, noteId, {}, form({ body: "Взломано" })),
    () => setContactFrequencyAction(contactId, "yearly"),
    () => setContactFrequencyAction(contactId, null),
    () => markContactedAction(contactId),
    () => undoContactedAction(contactId, null, new Date().toISOString()),
    () => setContactGroupAction(contactId, groupId, true),
    () => setContactGroupAction(contactId, groupId, false),
    () => createGroupForContactAction(contactId, {}, form({ name: "Взлом" })),
    () => renameGroupAction(groupId, {}, form({ name: "Взлом" })),
    () => deleteGroupAction(groupId),
  ];

  it("Попытка изменить чужие записи", async () => {
    const { contact, note, groupId } = await userAWithData();
    const before = await storedFor(a.id);

    const foreign: unknown[] = [];
    for (const attempt of attempts(contact.id, note.id, groupId)) {
      foreign.push(await outcome(attempt));
    }
    const missing: unknown[] = [];
    for (const attempt of attempts(MISSING, MISSING, MISSING)) {
      missing.push(await outcome(attempt));
    }

    // Same answer as for a record that does not exist...
    expect(foreign).toEqual(missing);
    // ...which says "not found" where there is something to say...
    expect(foreign).toContainEqual({ message: "Контакт не найден", values: expect.anything() });
    expect(foreign).toContainEqual({ error: "Контакт не найден" });
    expect(foreign).toContainEqual({ error: "Заметка не найдена", body: "Взломано" });
    expect(foreign).toContainEqual({ error: "Группа не найдена", name: "Взлом" });
    // ...and nothing of A's changed, and B got no record out of it.
    expect(await storedFor(a.id)).toEqual(before);
    expect(await storedFor(b.id)).toEqual({ contacts: [], notes: [], groups: [], members: [] });
  });

  it("Те же запросы на уровне функций", async () => {
    const { contact, note, groupId } = await userAWithData();
    const before = await storedFor(a.id);

    expect(await updateContact(b.id, contact.id, { name: "Взломано" } as never)).toBe(false);
    expect(await deleteContact(b.id, contact.id)).toBe(false);
    expect(await addNote(b.id, contact.id, "Взломано")).toBe(false);
    expect(await updateNote(b.id, contact.id, note.id, "Взломано")).toBe(false);
    expect(await setContactFrequency(b.id, contact.id, "yearly")).toBe(false);
    expect(await markContacted(b.id, contact.id)).toBeNull();
    expect(await undoContacted(b.id, contact.id, null, new Date())).toBe(false);
    expect(await setContactGroup(b.id, contact.id, groupId, true)).not.toBe("ok");
    expect(await renameGroup(b.id, groupId, "Взлом")).toBe("not-found");
    expect(await deleteGroup(b.id, groupId)).toBe(false);
    expect(await addContactToNewGroup(b.id, contact.id, "Взлом")).toBeNull();

    expect(await storedFor(a.id)).toEqual(before);
    expect(await storedFor(b.id)).toEqual({ contacts: [], notes: [], groups: [], members: [] });
  });

  it("Своя группа и чужой контакт", async () => {
    const { contact, groupId: groupOfA } = await userAWithData();
    const own = await makeContact(b.id, { name: "Анна Смирнова" });
    const groupOfB = await makeGroup(b.id, "Друзья");
    const before = await storedFor(a.id);

    // B puts A's contact into B's group, and B's contact into A's group.
    expect(await setContactGroup(b.id, contact.id, groupOfB, true)).toBe("contact-not-found");
    expect(await setContactGroup(b.id, own.id, groupOfA, true)).toBe("group-not-found");
    expect(await setContactGroupAction(contact.id, groupOfB, true)).toEqual({
      error: "Контакт не найден",
    });
    expect(await setContactGroupAction(own.id, groupOfA, true)).toEqual({
      error: "Группа не найдена",
    });

    // No new person in either group.
    expect(await storedFor(a.id)).toEqual(before);
    expect((await storedFor(b.id)).members).toEqual([]);
    expect(await getContactGroupIds(b.id, own.id)).toEqual([]);
  });
});

describe("Новый пользователь начинает с пустого", () => {
  it("Первый вход нового пользователя", async () => {
    const people = Array.from({ length: 50 }, (_, i) => `Контакт ${i + 1}`);
    const contacts = await makeContacts(a.id, people);
    const group = await makeGroup(a.id, "Теннис");
    await addMember(group, contacts[0].id);
    await setContactFrequency(a.id, contacts[0].id, "weekly");
    await makeNote(contacts[0].id, daysAgo(40));
    expect(await countContacts(a.id, ALL)).toBe(50);

    // B signs in for the first time: nothing of A's is there.
    expect(await countContacts(b.id, ALL)).toBe(0);
    expect(await listContacts(b.id, "", ALL)).toEqual([]);
    expect(await listOverdueContacts(b.id)).toEqual([]);
    expect(await listGroups(b.id)).toEqual([]);
  });
});
