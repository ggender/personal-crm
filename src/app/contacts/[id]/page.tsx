import { Calendar, Clock, Mail, Pencil, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addNoteAction,
  markContactedAction,
  setContactFrequencyAction,
  undoContactedAction,
  updateNoteAction,
} from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactAvatar } from "@/components/contact-avatar";
import { ContactFrequencyPicker } from "@/components/contact-frequency-picker";
import { ContactedButton } from "@/components/contacted-button";
import { NoteForm } from "@/components/note-form";
import { NoteItem } from "@/components/note-item";
import { Button } from "@/components/ui/button";
import {
  type ContactTouchStatus,
  getContact,
  getContactTouchStatus,
  listNotes,
} from "@/lib/contacts";
import { formatDate, formatDateTime, formatDay, formatOverdue, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
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

  const [contact, notes, touch] = await Promise.all([
    getContact(id),
    listNotes(id),
    getContactTouchStatus(id),
  ]);
  if (!contact || !touch) notFound();

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
    {
      label: "Как часто общаться",
      labelId: "frequency-label",
      // Lines the label up with the text of the 40px pills.
      labelClassName: "sm:pt-3",
      value: (
        <div className="pt-1.5 sm:pt-0">
          <ContactFrequencyPicker
            frequency={touch.frequency}
            action={setContactFrequencyAction.bind(null, contact.id)}
            labelledBy="frequency-label"
          />
          {touch.frequency && (
            <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
              <TouchStatus status={touch} />
              <ContactedButton
                mode="card"
                markAction={markContactedAction.bind(null, contact.id)}
                undoAction={undoContactedAction.bind(null, contact.id)}
              />
            </div>
          )}
        </div>
      ),
    },
    { label: "В контактах с", value: formatDate(contact.createdAt) },
  ].filter(Boolean) as {
    label: string;
    labelId?: string;
    labelClassName?: string;
    value: React.ReactNode;
  }[];

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
            <dt
              id={item.labelId}
              className={cn("text-14 text-subtle sm:pt-0.5", item.labelClassName)}
            >
              {item.label}
            </dt>
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

function TouchStatus({ status }: { status: Exclude<ContactTouchStatus, { frequency: null }> }) {
  return status.overdueDays > 0 ? (
    <p className="flex items-center gap-2 text-15 font-medium text-accent-text">
      <Clock className="size-4 shrink-0" />
      Пора связаться: {formatOverdue(status.overdueDays)}
    </p>
  ) : (
    <p className="flex items-center gap-2 text-15 text-muted">
      <Calendar className="size-4 shrink-0" />
      Связаться не позже {formatDay(status.dueDate)}
    </p>
  );
}
