import { CircleCheck, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { ContactSearch } from "@/components/contact-search";
import { CtaLink } from "@/components/cta-link";
import { ScrollIntoView } from "@/components/scroll-into-view";
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
    <main className="page-container pb-16">
      <header className="sticky top-0 z-10 -mx-5 bg-bg/90 px-5 pt-4 pb-4 backdrop-blur">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-serif text-26 font-medium sm:text-h2">Контакты</h1>
            <p className="mt-1 text-14 text-subtle">
              {query
                ? `Найдено ${items.length.toLocaleString("ru-RU")} из ${total.toLocaleString("ru-RU")}`
                : plural(total, CONTACT_WORDS)}
            </p>
          </div>
          <CtaLink href="/contacts/new">
            Добавить
            <span className="sr-only sm:not-sr-only"> контакт</span>
          </CtaLink>
        </div>
        <ContactSearch defaultValue={query} />
        {addedContact && (
          <div
            role="status"
            className="mt-3 flex items-center gap-3 rounded-14 border border-line-strong bg-note px-4 py-3 text-15 text-note-text"
          >
            <CircleCheck className="size-5 shrink-0 text-accent" />
            <p className="flex-1">
              Контакт <strong>{addedContact.name}</strong> добавлен — он выделен в списке.
            </p>
            <Link
              href={`/contacts/${addedContact.id}`}
              className="font-medium text-accent-text underline underline-offset-4"
            >
              Открыть
            </Link>
            <ScrollIntoView targetId={`contact-${addedContact.id}`} />
          </div>
        )}
        {deletedName && (
          <div
            role="status"
            className="mt-3 flex items-center gap-3 rounded-14 border border-line bg-surface-muted px-4 py-3 text-15 text-muted"
          >
            <Trash2 className="size-5 shrink-0 text-subtle" />
            <p className="min-w-0 flex-1 break-words">
              Контакт <strong>{deletedName}</strong> удалён.
            </p>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div className="space-y-5">
          {groupByLetter(items).map((group) => (
            <section key={group.letter} aria-label={`На букву ${group.letter}`}>
              <h2 className="px-4 pb-2 text-label font-medium text-accent-text uppercase">
                {group.letter}
              </h2>
              <ul className="rounded-16 border border-line bg-surface p-1.5">
                {group.items.map((contact) => (
                  <li
                    key={contact.id}
                    id={`contact-${contact.id}`}
                    className="[contain-intrinsic-size:auto_60px] [content-visibility:auto]"
                  >
                    <Link
                      href={`/contacts/${contact.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-12 px-2.5 py-2.5 transition-colors hover:bg-strip/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                        contact.id === addedId &&
                          "bg-note ring-2 ring-accent/50 ring-inset hover:bg-note",
                      )}
                    >
                      <ContactAvatar name={contact.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-17 font-medium">{contact.name}</p>
                        {contact.about && (
                          <p className="mt-0.5 truncate text-14 text-subtle">{contact.about}</p>
                        )}
                      </div>
                      {contact.phone && (
                        <span className="hidden shrink-0 text-14 text-subtle tabular-nums sm:block">
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
      <UserPlus className="size-10 text-faint" />
      {query ? (
        <>
          <p className="font-serif text-24 font-medium text-balance break-words">
            Никого не нашлось по запросу «{query}»
          </p>
          <p className="mb-2 text-15 text-muted">
            Проверьте написание или добавьте этого человека.
          </p>
          <CtaLink href={`/contacts/new?name=${encodeURIComponent(query)}`}>
            Добавить «{query}»
          </CtaLink>
        </>
      ) : (
        <>
          <p className="mb-2 font-serif text-24 font-medium">Пока нет ни одного контакта</p>
          <CtaLink href="/contacts/new">Добавить первый контакт</CtaLink>
        </>
      )}
    </div>
  );
}
