import Link from "next/link";

import { ScrollIntoView } from "@/components/scroll-into-view";
import { SearchBox } from "@/components/search-box";
import { buttonVariants } from "@/components/ui/button";
import { countContacts, listContacts, parseContactId } from "@/lib/contacts";
import { pluralize } from "@/lib/format";

const CONTACT_FORMS = ["контакт", "контакта", "контактов"] as const;

export default async function ContactsPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const addedId =
    typeof params.added === "string" ? parseContactId(params.added) : null;
  const deleted = params.deleted === "1";

  const [contacts, total] = await Promise.all([
    listContacts(query),
    countContacts(),
  ]);
  const added = addedId ? contacts.find((c) => c.id === addedId) : undefined;

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
        <p className="text-sm text-muted-foreground">
          {query
            ? `Найдено ${contacts.length} из ${total}`
            : `${total} ${pluralize(total, CONTACT_FORMS)}`}
        </p>
      </div>

      <SearchBox query={query} />

      {added && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Контакт «{added.name}» добавлен — он подсвечен в списке.{" "}
          <Link href={`/contacts/${added.id}`} className="font-medium underline">
            Открыть карточку
          </Link>
          <ScrollIntoView targetId={`contact-${added.id}`} />
        </div>
      )}

      {deleted && (
        <div
          role="status"
          className="rounded-lg border bg-background px-4 py-3 text-sm"
        >
          Контакт удалён.
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-background">
          {contacts.map((contact) => (
            <li key={contact.id} id={`contact-${contact.id}`}>
              <Link
                href={`/contacts/${contact.id}`}
                prefetch={false}
                data-added={contact.id === addedId || undefined}
                className="grid gap-1 px-4 py-3 transition-colors hover:bg-muted/60 data-added:bg-emerald-50 sm:grid-cols-[1fr_14rem] sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{contact.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[contact.about, contact.howWeMet]
                      .filter(Boolean)
                      .join(" · ") || "\u00a0"}
                  </p>
                </div>
                <div className="min-w-0 text-sm text-muted-foreground">
                  {contact.phone && <p className="truncate">{contact.phone}</p>}
                  {contact.email && <p className="truncate">{contact.email}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border bg-background px-4 py-12 text-center">
      {query ? (
        <>
          <p className="text-muted-foreground">
            Никого не нашлось по запросу «{query}»
          </p>
          <Link
            href={`/contacts/new?name=${encodeURIComponent(query)}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Добавить «{query}» как новый контакт
          </Link>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">Контактов пока нет</p>
          <Link href="/contacts/new" className={buttonVariants()}>
            Добавить первый контакт
          </Link>
        </>
      )}
    </div>
  );
}
