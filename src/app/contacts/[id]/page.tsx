import { ArrowLeft, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addNoteAction } from "@/app/actions";
import { ContactAvatar } from "@/components/contact-avatar";
import { NoteForm } from "@/components/note-form";
import { getContact, listNotes } from "@/lib/contacts";
import { formatDate, formatDateTime, plural } from "@/lib/format";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

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
          className="inline-flex items-center gap-2 hover:underline"
        >
          <Phone className="text-muted-foreground size-4" />
          <span className="tabular-nums">{contact.phone}</span>
        </a>
      ),
    },
    contact.email && {
      label: "Почта",
      value: (
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center gap-2 break-all hover:underline"
        >
          <Mail className="text-muted-foreground size-4 shrink-0" />
          {contact.email}
        </a>
      ),
    },
    contact.howWeMet && { label: "Откуда знакомы", value: contact.howWeMet },
    { label: "В контактах с", value: formatDate(contact.createdAt) },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Все контакты
      </Link>

      <header className="mb-6 flex items-center gap-4">
        <ContactAvatar id={contact.id} name={contact.name} className="size-16 text-xl" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{contact.name}</h1>
          {contact.about && <p className="text-muted-foreground">{contact.about}</p>}
        </div>
      </header>

      <dl className="bg-card mb-10 grid gap-4 rounded-xl border p-5 sm:grid-cols-[10rem_1fr] sm:gap-x-6 sm:gap-y-3">
        {details.map((item) => (
          <div key={item.label} className="contents">
            <dt className="text-muted-foreground text-sm sm:pt-0.5">{item.label}</dt>
            <dd className="-mt-3 whitespace-pre-wrap sm:mt-0">{item.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="notes-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="notes-heading" className="text-lg font-semibold">
            Заметки
          </h2>
          <span className="text-muted-foreground text-sm">
            {notes.length > 0 ? plural(notes.length, ["заметка", "заметки", "заметок"]) : null}
          </span>
        </div>

        <NoteForm action={addNoteAction.bind(null, contact.id)} />

        {notes.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">
            Заметок пока нет. Запишите, о чём говорили и о чём договорились.
          </p>
        ) : (
          <ol className="mt-6 space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="bg-card rounded-xl border p-4">
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="text-muted-foreground mb-1 block text-xs"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="break-words whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
