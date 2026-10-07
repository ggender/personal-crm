import { Mail, Pencil, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addNoteAction, updateNoteAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactAvatar } from "@/components/contact-avatar";
import { NoteForm } from "@/components/note-form";
import { NoteItem } from "@/components/note-item";
import { Button } from "@/components/ui/button";
import { getContact, listNotes } from "@/lib/contacts";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import { parseId } from "@/lib/validation";

const NOTE_WORDS: [string, string, string] = ["заметка", "заметки", "заметок"];

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const id = parseId((await params).id);
  const contact = id ? await getContact(id) : null;
  return { title: contact?.name ?? "Контакт не найден" };
}

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const id = parseId((await params).id);
  if (!id) notFound();

  const [contact, notes] = await Promise.all([getContact(id), listNotes(id)]);
  if (!contact) notFound();

  const details = [
    contact.phone && {
      label: "Телефон",
      value: (
        <a
          href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
        >
          <Phone className="size-4 text-subtle" />
          <span className="tabular-nums">{contact.phone}</span>
        </a>
      ),
    },
    contact.email && {
      label: "Почта",
      value: (
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center gap-2 break-all underline-offset-4 hover:underline"
        >
          <Mail className="size-4 shrink-0 text-subtle" />
          {contact.email}
        </a>
      ),
    },
    contact.howWeMet && { label: "Откуда знакомы", value: contact.howWeMet },
    { label: "В контактах с", value: formatDate(contact.createdAt) },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <main className="page-container pt-4 pb-16">
      <div className="mb-5 flex items-center justify-between gap-4">
        <BackLink href="/">Все контакты</BackLink>
        <Button asChild variant="outline" size="sm">
          <Link href={`/contacts/${contact.id}/edit`}>
            <Pencil />
            Изменить
          </Link>
        </Button>
      </div>

      <header className="mb-6 flex items-center gap-4">
        <ContactAvatar name={contact.name} className="size-14 text-20 sm:size-16 sm:text-24" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-26 leading-tight font-medium text-balance break-words sm:text-h2">
            {contact.name}
          </h1>
          {contact.about && <p className="mt-1 text-16 text-muted">{contact.about}</p>}
        </div>
      </header>

      <dl className="mb-10 rounded-20 border border-line-strong bg-surface px-5 shadow-card sm:px-6.5">
        {details.map((item) => (
          <div
            key={item.label}
            className="grid gap-1 border-dashed border-line-strong py-3.5 not-first:border-t sm:grid-cols-[10rem_1fr] sm:gap-6 sm:py-4"
          >
            <dt className="text-14 text-subtle sm:pt-0.5">{item.label}</dt>
            <dd className="text-16 whitespace-pre-wrap">{item.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="notes-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="notes-heading" className="text-label font-medium text-accent-text uppercase">
            Заметки
          </h2>
          <span className="text-14 text-subtle">
            {notes.length > 0 ? plural(notes.length, NOTE_WORDS) : null}
          </span>
        </div>

        <NoteForm action={addNoteAction.bind(null, contact.id)} />

        {notes.length === 0 ? (
          <p className="mt-6 text-15 text-muted">
            Заметок пока нет. Запишите, о чём говорили и о чём договорились.
          </p>
        ) : (
          <ol className="mt-6 space-y-3">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                body={note.body}
                time={
                  <time
                    dateTime={note.createdAt.toISOString()}
                    className="text-13 text-accent-text"
                  >
                    {formatDateTime(note.createdAt)}
                  </time>
                }
                updateAction={updateNoteAction.bind(null, contact.id, note.id)}
              />
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
