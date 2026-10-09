import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createGroupAction,
  createGroupForContactAction,
  deleteGroupAction,
  renameGroupAction,
} from "@/app/actions";
import {
  countContacts,
  createContact,
  deleteContact,
  type GroupFilter,
  listContacts,
  listOverdueContacts,
  updateContact,
} from "@/lib/contacts";
import { plural } from "@/lib/format";
import {
  contactsHref,
  emptyListMessage,
  GROUPS_PAGE_HREF,
  groupFilterItems,
  resolveGroupFilter,
} from "@/lib/group-filter";
import {
  addContactToNewGroup,
  createGroup,
  deleteGroup,
  getContactGroupIds,
  listGroups,
  renameGroup,
  setContactGroup,
} from "@/lib/groups";
import { contactInputSchema, contactUpdateSchema, groupNameSchema } from "@/lib/validation";

import { addMember, closeDb, makeContact, makeContacts, makeGroup, resetDb } from "./helpers/db";

const CONTACT_WORDS: [string, string, string] = ["контакт", "контакта", "контактов"];

function nameForm(name: string) {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

const ALL: GroupFilter = { kind: "all" };
const NONE: GroupFilter = { kind: "none" };
const inGroup = (groupId: number): GroupFilter => ({ kind: "group", groupId });

const groupNames = async () => (await listGroups()).map((group) => group.name);
const namesIn = async (filter: GroupFilter, query = "") =>
  (await listContacts(query, filter)).map((contact) => contact.name);
const filterButtons = async (filter: GroupFilter, query = "") =>
  groupFilterItems(await listGroups(), filter, query);
const labels = (items: { label: string }[]) => items.map((item) => item.label);
const selectedLabels = (items: { label: string; selected: boolean }[]) =>
  items.filter((item) => item.selected).map((item) => item.label);

beforeEach(resetDb);
afterAll(closeDb);

describe("Группы создаёт владелец", () => {
  it("Сначала групп нет", async () => {
    expect(await listGroups()).toEqual([]);
    expect(await filterButtons(ALL)).toEqual([]);
  });

  it("Создание группы на странице «Группы»", async () => {
    const created = await createGroup(groupNameSchema.parse("  Теннис  "));

    expect(created).toEqual({ id: expect.any(Number) });
    const groups = await listGroups();
    expect(groups).toEqual([{ id: expect.any(Number), name: "Теннис", contactCount: 0 }]);
    expect(plural(groups[0].contactCount, CONTACT_WORDS)).toBe("0 контактов");
    expect(labels(await filterButtons(ALL))).toContain("Теннис");
  });

  it("Пустое название", async () => {
    for (const name of ["", "   "]) {
      const state = await createGroupAction({}, nameForm(name));
      expect(state.error).toBe("Укажите название");
    }
    expect(await listGroups()).toEqual([]);
  });

  it("Слишком длинное название", async () => {
    // The field cuts a pasted text to 50 characters; the server accepts exactly those 50.
    const pasted = "ж".repeat(80);
    const first50 = pasted.slice(0, 50);

    expect(groupNameSchema.safeParse(pasted).success).toBe(false);
    await createGroup(groupNameSchema.parse(first50));

    expect(await groupNames()).toEqual([first50]);
  });
});

describe("Названия групп не повторяются", () => {
  it("Повтор при создании", async () => {
    await createGroup("Теннис");

    expect(await createGroup("теннис")).toEqual({ duplicateOf: "Теннис" });
    const state = await createGroupAction({}, nameForm("теннис"));

    expect(state.error).toBe("Группа «Теннис» уже есть");
    expect(await groupNames()).toEqual(["Теннис"]);
  });

  it("Повтор при переименовании", async () => {
    await createGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const ivan = await makeContact({ name: "Иван" });
    await addMember(friends, ivan.id);

    expect(await renameGroup(friends, "ТЕННИС")).toEqual({ duplicateOf: "Теннис" });
    const state = await renameGroupAction(friends, {}, nameForm("ТЕННИС"));

    expect(state.error).toBe("Группа «Теннис» уже есть");
    expect(await listGroups()).toEqual([
      { id: friends, name: "Друзья", contactCount: 1 },
      { id: expect.any(Number), name: "Теннис", contactCount: 0 },
    ]);
  });
});

describe("Страница «Группы»", () => {
  it("Список групп с числом людей", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    await makeGroup("Семья");
    const people = await Promise.all(["А", "Б", "В"].map((name) => makeContact({ name })));
    for (const person of people) await addMember(tennis, person.id);
    await addMember(friends, people[0].id);

    const groups = await listGroups();

    expect(
      groups.map((group) => `${group.name} — ${plural(group.contactCount, CONTACT_WORDS)}`),
    ).toEqual(["Друзья — 1 контакт", "Семья — 0 контактов", "Теннис — 3 контакта"]);
  });

  it("Переход к людям группы", async () => {
    const tennis = await makeGroup("Теннис");
    const people = await makeContacts(["Анна", "Борис", "Вера", "Глеб"]);
    for (const person of people.slice(0, 3)) await addMember(tennis, person.id);

    const href = contactsHref({ filter: inGroup(tennis), query: "" });

    expect(href).toBe(`/?group=${tennis}`);
    const raw = new URL(href, "http://crm.test").searchParams.get("group");
    const filter = resolveGroupFilter(raw, await listGroups());
    expect(selectedLabels(await filterButtons(filter))).toEqual(["Теннис"]);
    expect(await namesIn(filter)).toEqual(["Анна", "Борис", "Вера"]);
  });

  it("Как попасть на страницу «Группы»", async () => {
    await makeGroup("Теннис");

    const items = await filterButtons(ALL);

    expect(GROUPS_PAGE_HREF).toBe("/groups");
    expect(items.at(-1)).toMatchObject({ label: "Группы", href: GROUPS_PAGE_HREF });
  });
});

describe("Переименование группы", () => {
  it("Пустое название при переименовании", async () => {
    const tennis = await makeGroup("Теннис");

    const state = await renameGroupAction(tennis, {}, nameForm(""));

    expect(state.error).toBe("Укажите название");
    expect(await groupNames()).toEqual(["Теннис"]);
  });

  it("Переименование", async () => {
    const tennis = await makeGroup("Теннис");
    const [anna, boris] = await makeContacts(["Анна", "Борис"]);
    await addMember(tennis, anna.id);
    await addMember(tennis, boris.id);

    expect(await renameGroup(tennis, "Большой теннис")).toBe("ok");

    const items = await filterButtons(inGroup(tennis));
    expect(selectedLabels(items)).toEqual(["Большой теннис"]);
    expect(await namesIn(inGroup(tennis))).toEqual(["Анна", "Борис"]);
    const labelsInList = (await listContacts("", ALL)).map((contact) => contact.groups);
    expect(labelsInList).toEqual([["Большой теннис"], ["Большой теннис"]]);
    expect(await groupNames()).toEqual(["Большой теннис"]);
  });
});

describe("Удаление группы", () => {
  it("Удаление группы", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const ivan = await makeContact({ name: "Иван" });
    await addMember(tennis, ivan.id);
    await addMember(friends, ivan.id);

    expect(await deleteGroup(tennis)).toBe(true);

    expect(await groupNames()).toEqual(["Друзья"]);
    expect(await getContactGroupIds(ivan.id)).toEqual([friends]);
  });

  it("Передумал удалять", async () => {
    // "Отмена" in the dialog never reaches the server (checked by hand); what the server can
    // show is that a refused deletion leaves the group and its people as they were.
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact({ name: "Иван" });
    await addMember(tennis, ivan.id);

    const result = await deleteGroupAction(0);

    expect(result.error).toBe("Группа не найдена");
    expect(await listGroups()).toEqual([{ id: tennis, name: "Теннис", contactCount: 1 }]);
  });
});

describe("Удаление контакта убирает его из групп", () => {
  it("Удалён человек из группы", async () => {
    const tennis = await makeGroup("Теннис");
    const people = await Promise.all(["А", "Б", "В"].map((name) => makeContact({ name })));
    for (const person of people) await addMember(tennis, person.id);

    expect(await deleteContact(people[0].id)).toBe(true);

    const [group] = await listGroups();
    expect(plural(group.contactCount, CONTACT_WORDS)).toBe("2 контакта");
  });
});

describe("Фильтр по группе на главной", () => {
  it("Групп нет — фильтра нет", async () => {
    await makeContact({ name: "Иван" });

    expect(await filterButtons(ALL)).toEqual([]);
    expect(await namesIn(ALL)).toEqual(["Иван"]);
  });

  it("Состав фильтра", async () => {
    await makeGroup("Теннис");
    await makeGroup("Друзья");

    const items = await filterButtons(ALL);

    expect(labels(items)).toEqual(["Все", "Друзья", "Теннис", "Без группы", "Группы"]);
    expect(selectedLabels(items)).toEqual(["Все"]);
  });

  it("Одна группа за раз", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const [anna, boris] = await makeContacts(["Анна", "Борис"]);
    await addMember(tennis, anna.id);
    await addMember(friends, boris.id);

    expect(selectedLabels(await filterButtons(inGroup(tennis)))).toEqual(["Теннис"]);
    const items = await filterButtons(inGroup(friends));

    expect(selectedLabels(items)).toEqual(["Друзья"]);
    expect(await namesIn(inGroup(friends))).toEqual(["Борис"]);
  });
});

describe("Список при выбранной группе", () => {
  const fiftyContacts = () =>
    makeContacts(Array.from({ length: 50 }, (_, i) => `Контакт ${String(i + 1).padStart(2, "0")}`));

  it("Выбор группы", async () => {
    const tennis = await makeGroup("Теннис");
    const people = await fiftyContacts();
    // Added out of alphabetical order: the list must sort them itself.
    for (const index of [30, 4, 17]) await addMember(tennis, people[index].id);

    const filter = inGroup(tennis);

    expect(await namesIn(filter)).toEqual(["Контакт 05", "Контакт 18", "Контакт 31"]);
    expect(plural(await countContacts(filter), CONTACT_WORDS)).toBe("3 контакта");
  });

  it("Человек из нескольких групп", async () => {
    const friends = await makeGroup("Друзья");
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact({ name: "Иван" });
    await addMember(friends, ivan.id);
    await addMember(tennis, ivan.id);

    expect(await namesIn(inGroup(friends))).toEqual(["Иван"]);
    expect(await namesIn(inGroup(tennis))).toEqual(["Иван"]);
  });

  it("Возврат ко всем", async () => {
    const tennis = await makeGroup("Теннис");
    const people = await fiftyContacts();
    await addMember(tennis, people[0].id);

    expect(await namesIn(ALL)).toHaveLength(50);
    expect(plural(await countContacts(ALL), CONTACT_WORDS)).toBe("50 контактов");
    expect(selectedLabels(await filterButtons(ALL))).toEqual(["Все"]);
  });
});

describe("Люди без группы", () => {
  it("Кого ещё не разложил", async () => {
    const tennis = await makeGroup("Теннис");
    const people = await makeContacts(
      Array.from({ length: 50 }, (_, i) => `Контакт ${String(i + 1).padStart(2, "0")}`),
    );
    for (const person of people.slice(0, 10)) await addMember(tennis, person.id);

    const rows = await listContacts("", NONE);

    expect(rows).toHaveLength(40);
    expect(rows.every((row) => row.groups.length === 0)).toBe(true);
    expect(plural(await countContacts(NONE), CONTACT_WORDS)).toBe("40 контактов");
  });

  it("Все разложены", async () => {
    const tennis = await makeGroup("Теннис");
    const [anna] = await makeContacts(["Анна"]);
    await addMember(tennis, anna.id);

    expect(await listContacts("", NONE)).toEqual([]);
    const message = emptyListMessage(NONE, await listGroups(), "");
    expect(message?.title).toBe("Все контакты разложены по группам");
  });
});

describe("Пустая группа", () => {
  it("В группе никого нет", async () => {
    const family = await makeGroup("Семья");
    await makeContact({ name: "Иван" });

    expect(await namesIn(inGroup(family))).toEqual([]);
    expect(plural(await countContacts(inGroup(family)), CONTACT_WORDS)).toBe("0 контактов");
    const message = emptyListMessage(inGroup(family), await listGroups(), "");
    expect(message?.title).toBe("В группе «Семья» пока никого нет");
  });
});

describe("Выбранная группа сохраняется в адресе", () => {
  async function tennisWithPeople() {
    const tennis = await makeGroup("Теннис");
    const [anna, boris] = await makeContacts(["Анна", "Борис"]);
    await addMember(tennis, anna.id);
    await addMember(tennis, boris.id);
    return tennis;
  }

  const groupParam = (href: string) => new URL(href, "http://crm.test").searchParams.get("group");

  it("После обновления страницы", async () => {
    const tennis = await tennisWithPeople();
    const href = contactsHref({ filter: inGroup(tennis), query: "" });

    // A reload opens the same address: the group comes back from it, not from page state.
    const filter = resolveGroupFilter(groupParam(href), await listGroups());

    expect(filter).toEqual(inGroup(tennis));
    expect(selectedLabels(await filterButtons(filter))).toEqual(["Теннис"]);
    expect(await namesIn(filter)).toEqual(["Анна", "Борис"]);
  });

  it("Ссылка в другом браузере", async () => {
    const tennis = await tennisWithPeople();
    const href = contactsHref({ filter: inGroup(tennis), query: "" });
    const before = await namesIn(inGroup(tennis));

    // Another browser has nothing but the copied address.
    const filter = resolveGroupFilter(groupParam(href), await listGroups());

    expect(await namesIn(filter)).toEqual(before);
    expect(selectedLabels(await filterButtons(filter))).toEqual(["Теннис"]);
  });

  it("Ссылка на удалённую группу", async () => {
    const tennis = await tennisWithPeople();
    await makeGroup("Друзья");
    const href = contactsHref({ filter: inGroup(tennis), query: "" });
    await deleteGroup(tennis);

    const groups = await listGroups();
    const filter = resolveGroupFilter(groupParam(href), groups);

    expect(filter).toEqual(ALL);
    expect(selectedLabels(groupFilterItems(groups, filter, ""))).toEqual(["Все"]);
    expect(await namesIn(filter)).toEqual(["Анна", "Борис"]);
    // Anything that is not a known group id opens the whole list as well.
    for (const raw of ["99999", "abc", "-1", "1.5", "", null, undefined, ["1", "2"]]) {
      expect(resolveGroupFilter(raw, groups)).toEqual(ALL);
    }
    expect(resolveGroupFilter("none", groups)).toEqual(NONE);
  });
});

describe("Поиск внутри группы", () => {
  async function tennisAndFriends() {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const petrov = await makeContact({ name: "Иван Петров" });
    const anna = await makeContact({ name: "Анна" });
    const sidorov = await makeContact({ name: "Иван Сидоров" });
    await addMember(tennis, petrov.id);
    await addMember(tennis, anna.id);
    await addMember(friends, sidorov.id);
    return { tennis, friends };
  }

  it("Поиск в группе", async () => {
    const { tennis } = await tennisAndFriends();

    const found = await namesIn(inGroup(tennis), "иван");
    const inSelection = await countContacts(inGroup(tennis));

    expect(found).toEqual(["Иван Петров"]);
    expect(`Найдено ${found.length} из ${inSelection}`).toBe("Найдено 1 из 2");
  });

  it("Смена группы не сбрасывает поиск", async () => {
    const { tennis, friends } = await tennisAndFriends();

    const items = await filterButtons(inGroup(tennis), "иван");

    // Every button of the filter keeps the query in its address.
    const filterItems = items.filter((item) => item.label !== "Группы");
    expect(filterItems.length).toBeGreaterThan(0);
    for (const item of filterItems) {
      expect(new URL(item.href, "http://crm.test").searchParams.get("q")).toBe("иван");
    }
    const friendsItem = items.find((item) => item.label === "Друзья");
    const params = new URL(friendsItem!.href, "http://crm.test").searchParams;
    expect(params.get("group")).toBe(String(friends));
    expect(await namesIn(inGroup(friends), params.get("q") ?? "")).toEqual(["Иван Сидоров"]);
  });

  it("Не нашлось в группе", async () => {
    const { tennis } = await tennisAndFriends();
    const groups = await listGroups();

    expect(await namesIn(inGroup(tennis), "Сидоров")).toEqual([]);
    const message = emptyListMessage(inGroup(tennis), groups, "Сидоров");

    expect(message?.title).toBe("Никого не нашлось по запросу «Сидоров» в группе «Теннис»");
    expect(message?.searchAllHref).toBe(contactsHref({ filter: ALL, query: "Сидоров" }));
    expect(message?.searchAllHref).toBe(`/?q=${encodeURIComponent("Сидоров")}`);
    // The link opens the whole list: "Все" is selected and the person is found.
    const filter = resolveGroupFilter(null, groups);
    expect(filter).toEqual(ALL);
    expect(await namesIn(filter, "Сидоров")).toEqual(["Иван Сидоров"]);
  });
});

describe("Фильтр не влияет на «Пора связаться»", () => {
  it("Просроченный из другой группы", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const longAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const sidorov = await makeContact({
      name: "Иван Сидоров",
      contactFrequency: "weekly",
      createdAt: longAgo,
    });
    await addMember(friends, sidorov.id);
    const anna = await makeContact({ name: "Анна" });
    await addMember(tennis, anna.id);

    const overdue = await listOverdueContacts();

    expect(overdue.map((contact) => contact.name)).toEqual(["Иван Сидоров"]);
    expect(await namesIn(inGroup(tennis))).toEqual(["Анна"]);
  });
});

describe("Метки групп в списке", () => {
  it("Метки под именем", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const ivan = await makeContact({ name: "Иван" });
    await addMember(tennis, ivan.id);
    await addMember(friends, ivan.id);

    const [row] = await listContacts("", ALL);

    expect(row.groups).toEqual(["Друзья", "Теннис"]);
  });

  it("Без групп — без меток", async () => {
    await makeGroup("Теннис");
    await makeContact({ name: "Иван" });

    const [row] = await listContacts("", ALL);

    expect(row.groups).toEqual([]);
  });

  it("В блоке «Пора связаться» меток нет", async () => {
    const friends = await makeGroup("Друзья");
    const ivan = await makeContact({
      name: "Иван",
      contactFrequency: "weekly",
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });
    await addMember(friends, ivan.id);

    const [overdueRow] = await listOverdueContacts();
    const [listRow] = await listContacts("", ALL);

    expect(overdueRow.name).toBe("Иван");
    expect(overdueRow).not.toHaveProperty("groups");
    expect(listRow.groups).toEqual(["Друзья"]);
  });
});

describe("Группы отмечаются на странице контакта", () => {
  it("Человек сразу в нескольких группах", async () => {
    const tennis = await makeGroup("Теннис");
    const friends = await makeGroup("Друзья");
    const ivan = await makeContact({ name: "Иван" });

    expect(await setContactGroup(ivan.id, friends, true)).toBe("ok");
    expect(await setContactGroup(ivan.id, tennis, true)).toBe("ok");

    // The page reads the groups from the database: any browser, any reload sees the same.
    expect(await getContactGroupIds(ivan.id)).toEqual([friends, tennis]);
  });

  it("Убрать человека из группы", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact({ name: "Иван" });
    await addMember(tennis, ivan.id);

    expect(await setContactGroup(ivan.id, tennis, false)).toBe("ok");

    expect(await getContactGroupIds(ivan.id)).toEqual([]);
    expect(await namesIn(inGroup(tennis))).toEqual([]);
  });

  it("У нового контакта групп нет", async () => {
    await makeGroup("Теннис");

    const id = await createContact(
      contactInputSchema.parse({
        name: "Иван",
        about: "",
        howWeMet: "",
        phone: "",
        email: "",
        firstNote: "",
      }),
    );

    expect(await getContactGroupIds(id)).toEqual([]);
    const [row] = await listContacts("", ALL);
    expect(row.groups).toEqual([]);
  });
});

describe("В формах контакта групп нет", () => {
  it("В формах поля нет", () => {
    for (const schema of [contactInputSchema, contactUpdateSchema]) {
      expect(Object.keys(schema.shape).filter((field) => /group/i.test(field))).toEqual([]);
    }
  });

  it("Правка контакта не трогает группы", async () => {
    const friends = await makeGroup("Друзья");
    const ivan = await makeContact({ name: "Иван", phone: "+7 900 000-00-00" });
    await addMember(friends, ivan.id);

    const fields = contactUpdateSchema.parse({
      name: "Иван",
      about: "",
      howWeMet: "",
      phone: "+7 900 111-11-11",
      email: "",
    });
    expect(await updateContact(ivan.id, fields)).toBe(true);

    expect(await getContactGroupIds(ivan.id)).toEqual([friends]);
  });
});

describe("Новая группа прямо со страницы контакта", () => {
  it("Новая группа на ходу", async () => {
    const [ivan, anna] = await makeContacts(["Иван", "Анна"]);

    const added = await addContactToNewGroup(ivan.id, "Аналитики");

    expect(added).toEqual({ groupId: expect.any(Number) });
    expect(await getContactGroupIds(ivan.id)).toEqual([added!.groupId]);
    const groups = await listGroups();
    expect(
      groups.map((group) => `${group.name} — ${plural(group.contactCount, CONTACT_WORDS)}`),
    ).toEqual(["Аналитики — 1 контакт"]);
    expect(await getContactGroupIds(anna.id)).toEqual([]);
  });

  it("Такая группа уже есть", async () => {
    const tennis = await makeGroup("Теннис");
    const ivan = await makeContact({ name: "Иван" });

    const added = await addContactToNewGroup(ivan.id, "теннис");

    expect(added).toEqual({ groupId: tennis });
    expect(await getContactGroupIds(ivan.id)).toEqual([tennis]);
    expect(await groupNames()).toEqual(["Теннис"]);
  });

  it("Пустое название на странице контакта", async () => {
    const ivan = await makeContact({ name: "Иван" });

    const state = await createGroupForContactAction(ivan.id, {}, nameForm("   "));

    expect(state.error).toBe("Укажите название");
    expect(await listGroups()).toEqual([]);
  });
});
