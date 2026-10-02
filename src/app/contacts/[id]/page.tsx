import { ArrowLeftIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { addNote, deleteNote } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { NoteForm } from "@/components/note-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getContact, getContactNotes, parseContactId } from "@/lib/contacts";
import { formatDate, formatDateTime } from "@/lib/format";

export async function generateMetadata({
  params,
}: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const id = parseContactId((await params).id);
  const contact = id ? await getContact(id) : null;
  return { title: contact?.name ?? "Контакт не найден" };
}

export default async function ContactPage({
  params,
}: PageProps<"/contacts/[id]">) {
  const id = parseContactId((await params).id);
  if (!id) notFound();

  const [contact, notes] = await Promise.all([
    getContact(id),
    getContactNotes(id),
  ]);
  if (!contact) notFound();

  const details = [
    { label: "Кто это", value: contact.about },
    { label: "Откуда знакомы", value: contact.howWeMet },
    {
      label: "Телефон",
      value: contact.phone,
      href: contact.phone && `tel:${contact.phone.replace(/[^\d+]/g, "")}`,
    },
    {
      label: "Почта",
      value: contact.email,
      href: contact.email && `mailto:${contact.email}`,
    },
  ];

  return (
    <div className="grid gap-4">
      <Link
        href="/"
        className={`${buttonVariants({ variant: "ghost" })} justify-self-start`}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Все контакты
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">{contact.name}</CardTitle>
          <CardAction>
            <Link
              href={`/contacts/${contact.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              <PencilIcon data-icon="inline-start" />
              Изменить
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
            {details.map(({ label, value, href }) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap">
                  {value ? (
                    href ? (
                      <a href={href} className="underline-offset-4 hover:underline">
                        {value}
                      </a>
                    ) : (
                      value
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            В списке с {formatDate(contact.createdAt)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Заметки{" "}
            <span className="font-normal text-muted-foreground">{notes.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <NoteForm action={addNote.bind(null, contact.id)} />

          {notes.length > 0 ? (
            <>
              <Separator />
              <ol className="grid gap-4">
                {notes.map((note) => (
                  <li key={note.id} className="grid gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <time
                        dateTime={note.createdAt.toISOString()}
                        className="text-xs text-muted-foreground"
                      >
                        {formatDateTime(note.createdAt)}
                      </time>
                      <ConfirmDeleteButton
                        action={deleteNote.bind(null, contact.id, note.id)}
                        title="Удалить заметку?"
                        description={`Заметка от ${formatDateTime(note.createdAt)} удалится навсегда, вернуть её не получится.`}
                        confirmLabel="Удалить заметку"
                        trigger={<Trash2Icon />}
                        triggerProps={{
                          variant: "ghost",
                          size: "icon-sm",
                          "aria-label": "Удалить заметку",
                          className: "text-muted-foreground hover:text-destructive",
                        }}
                      />
                    </div>
                    <p className="whitespace-pre-wrap">{note.body}</p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Заметок пока нет. Запишите, о чём поговорили, чтобы не забыть.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
