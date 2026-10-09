// The group filter on the home page, as plain functions without server dependencies.
// The filter lives in the address (`?group=12`, `?group=none`, together with `?q=`).
import type { GroupFilter } from "@/lib/contacts";

export const GROUPS_PAGE_HREF = "/groups";

type GroupRef = { id: number; name: string };

const ALL: GroupFilter = { kind: "all" };

/**
 * Reads the `group` parameter of the address. An unknown or deleted group, or anything that is
 * not a group id, opens the whole list.
 */
export function resolveGroupFilter(
  raw: string | string[] | null | undefined,
  groups: { id: number }[],
): GroupFilter {
  if (raw === "none") return { kind: "none" };
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return ALL;
  const groupId = Number(raw);
  return groups.some((group) => group.id === groupId) ? { kind: "group", groupId } : ALL;
}

/** The address of the home page with the given filter and search query. */
export function contactsHref({ filter, query }: { filter: GroupFilter; query: string }) {
  const params: string[] = [];
  if (filter.kind === "group") params.push(`group=${filter.groupId}`);
  if (filter.kind === "none") params.push("group=none");
  if (query) params.push(`q=${encodeURIComponent(query)}`);
  return params.length > 0 ? `/?${params.join("&")}` : "/";
}

export type GroupFilterItem = {
  key: string;
  label: string;
  href: string;
  selected: boolean;
  /** The link to the "Группы" page rather than a choice of the filter. */
  manage?: true;
};

/**
 * The buttons of the filter in order: "Все", the groups, "Без группы", then the link to the
 * "Группы" page. Every address keeps the search query. No groups means no filter: empty list.
 */
export function groupFilterItems(
  groups: GroupRef[],
  filter: GroupFilter,
  query: string,
): GroupFilterItem[] {
  if (groups.length === 0) return [];
  const choice = (key: string, label: string, target: GroupFilter): GroupFilterItem => ({
    key,
    label,
    href: contactsHref({ filter: target, query }),
    selected: isSame(filter, target),
  });
  return [
    choice("all", "Все", ALL),
    ...groups.map((group) =>
      choice(`group-${group.id}`, group.name, { kind: "group", groupId: group.id }),
    ),
    choice("none", "Без группы", { kind: "none" }),
    { key: "manage", label: "Группы", href: GROUPS_PAGE_HREF, selected: false, manage: true },
  ];
}

function isSame(a: GroupFilter, b: GroupFilter) {
  if (a.kind !== b.kind) return false;
  return a.kind !== "group" || (b.kind === "group" && a.groupId === b.groupId);
}

export type EmptyListMessage = {
  title: string;
  /** Address of the same search over all contacts, when the filter narrowed it down. */
  searchAllHref?: string;
};

/**
 * What to write instead of an empty list while a group or "Без группы" is chosen.
 * Null for "Все": the home page has its own text for that.
 */
export function emptyListMessage(
  filter: GroupFilter,
  groups: GroupRef[],
  query: string,
): EmptyListMessage | null {
  if (filter.kind === "all") return null;
  const groupName =
    filter.kind === "group"
      ? (groups.find((group) => group.id === filter.groupId)?.name ?? "")
      : "";

  if (query) {
    const where = filter.kind === "group" ? `в группе «${groupName}»` : "среди людей без группы";
    return {
      title: `Никого не нашлось по запросу «${query}» ${where}`,
      searchAllHref: contactsHref({ filter: ALL, query }),
    };
  }
  return {
    title:
      filter.kind === "group"
        ? `В группе «${groupName}» пока никого нет`
        : "Все контакты разложены по группам",
  };
}
