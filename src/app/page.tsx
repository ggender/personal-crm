import { CircleCheck, Plus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { ContactSearch } from "@/components/contact-search";
import { ScrollIntoView } from "@/components/scroll-into-view";
import { Button } from "@/components/ui/button";
import { countContacts, listContacts } from "@/lib/contacts";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const CONTACT_WORDS: [string, string, string] = ["контакт", "контакта", "контактов"];

type ContactListItem = Awaited<ReturnType<typeof listContacts>>[number];

function groupByLetter(items: ContactListItem[]) {
  const groups: { letter: string; items: ContactListItem[] }[] = [];
  for (const item of items) {
    const first = item.name.trim()[0]?.toUpperCase() ?? "#";
    const letter = /\p{L}/u.test(first) ? first : "#";
    const last = groups.at(-1);
    if (last?.letter === letter) last.items.push(item);
    else groups.push({ letter, items: [item] });
  }
  return groups;
}

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const { q, added, deleted } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const addedId = typeof added === "string" ? Number(added) : null;
  const deletedName = typeof deleted === "string" ? deleted : null;

  const [items, total] = await Promise.all([listContacts(query), countContacts()]);
  const addedContact = addedId ? items.find((item) => item.id === addedId) : undefined;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <header className="bg-background/90 sticky top-0 z-10 -mx-4 px-4 pt-6 pb-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
            <p className="text-muted-foreground text-sm">
              {query
                ? `Найдено ${items.length.toLocaleString("ru-RU")} из ${total.toLocaleString("ru-RU")}`
                : plural(total, CONTACT_WORDS)}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/contacts/new">
              <Plus />
              Добавить
              <span className="sr-only sm:not-sr-only"> контакт</span>
            </Link>
          </Button>
        </div>
        <ContactSearch defaultValue={query} />
        {addedContact && (
          <div
            role="status"
            className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-600/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            <CircleCheck className="size-5 shrink-0 text-emerald-600" />
            <p className="flex-1">
              Контакт <strong>{addedContact.name}</strong> добавлен — он выделен в списке.
            </p>
            <Link
              href={`/contacts/${addedContact.id}`}
              className="font-medium underline underline-offset-4"
            >
              Открыть
            </Link>
            <ScrollIntoView targetId={`contact-${addedContact.id}`} />
          </div>
        )}
        {deletedName && (
          <div
            role="status"
            className="bg-muted/60 mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
          >
            <Trash2 className="text-muted-foreground size-5 shrink-0" />
            <p className="min-w-0 flex-1 break-words">
              Контакт <strong>{deletedName}</strong> удалён.
            </p>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div className="space-y-4">
          {groupByLetter(items).map((group) => (
            <section key={group.letter} aria-label={`На букву ${group.letter}`}>
              <h2 className="text-muted-foreground px-3 pb-1 text-xs font-semibold">
                {group.letter}
              </h2>
              <ul className="divide-border/60 divide-y">
                {group.items.map((contact) => (
                  <li
                    key={contact.id}
                    id={`contact-${contact.id}`}
                    className="[contain-intrinsic-size:auto_60px] [content-visibility:auto]"
                  >
                    <Link
                      href={`/contacts/${contact.id}`}
                      className={cn(
                        "hover:bg-muted focus-visible:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-none",
                        contact.id === addedId &&
                          "bg-emerald-50 ring-2 ring-emerald-500/60 ring-inset hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60",
                      )}
                    >
                      <ContactAvatar id={contact.id} name={contact.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{contact.name}</p>
                        {contact.about && (
                          <p className="text-muted-foreground truncate text-sm">{contact.about}</p>
                        )}
                      </div>
                      {contact.phone && (
                        <span className="text-muted-foreground hidden shrink-0 text-sm tabular-nums sm:block">
                          {contact.phone}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <UserPlus className="text-muted-foreground size-10" />
      {query ? (
        <>
          <p className="text-lg font-medium">Никого не нашлось по запросу «{query}»</p>
          <p className="text-muted-foreground text-sm">
            Проверьте написание или добавьте этого человека.
          </p>
          <Button asChild variant="outline">
            <Link href={`/contacts/new?name=${encodeURIComponent(query)}`}>
              <Plus />
              Добавить «{query}»
            </Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-lg font-medium">Пока нет ни одного контакта</p>
          <Button asChild>
            <Link href="/contacts/new">
              <Plus />
              Добавить первый контакт
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
