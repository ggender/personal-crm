import { Users } from "lucide-react";
import Link from "next/link";

import { ScrollRowToSelected } from "@/components/scroll-row-to-selected";
import type { GroupFilterItem } from "@/lib/group-filter";
import { cn } from "@/lib/utils";

const ROW_ID = "group-filter-row";

/**
 * "Все", the groups, "Без группы" and the link to the "Группы" page as one row of pills: plain
 * links, so the choice lives in the address. One line; on a narrow screen it scrolls sideways.
 * Renders nothing while there are no groups.
 */
export function GroupFilter({ items }: { items: GroupFilterItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Фильтр по группам" className="mt-3">
      <ul
        id={ROW_ID}
        className="relative -mx-5 flex [scrollbar-width:thin] gap-2 overflow-x-auto px-5 pb-1"
      >
        {items.map((item) => (
          <li key={item.key} className={cn("shrink-0", item.manage && "ml-auto pl-2")}>
            <Link
              href={item.href}
              aria-current={item.selected ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-14 font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                item.selected
                  ? "border-ink bg-ink font-semibold text-bg"
                  : "border-line-strong bg-surface hover:bg-strip",
                item.manage && "text-muted",
              )}
            >
              {item.manage && <Users className="size-4" />}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <ScrollRowToSelected rowId={ROW_ID} />
    </nav>
  );
}
