import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteContactAction, updateContactAction } from "@/app/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ContactForm } from "@/components/contact-form";
import { Button } from "@/components/ui/button";
import { countNotes, getContact } from "@/lib/contacts";
import { parseId } from "@/lib/validation";

export async function generateMetadata({
  params,
}: PageProps<"/contacts/[id]/edit">): Promise<Metadata> {
  const id = parseId((await params).id);
  const contact = id ? await getContact(id) : null;
  return { title: contact ? `Изменить: ${contact.name}` : "Контакт не найден" };
}

export default async function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  const id = parseId((await params).id);
  if (!id) notFound();

  const [contact, notesCount] = await Promise.all([getContact(id), countNotes(id)]);
  if (!contact) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href={`/contacts/${contact.id}`}
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />К карточке
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Изменить контакт</h1>
      <ContactForm
        action={updateContactAction.bind(null, contact.id)}
        initialValues={{
          name: contact.name,
          about: contact.about ?? "",
          howWeMet: contact.howWeMet ?? "",
          phone: contact.phone ?? "",
          email: contact.email ?? "",
        }}
        submitLabel="Сохранить изменения"
        cancelHref={`/contacts/${contact.id}`}
      />

      {/* Rare and irreversible, so it lives here rather than on the contact page. */}
      <div className="mt-10 border-t pt-6">
        <ConfirmDelete
          title={`Удалить «${contact.name}»?`}
          description={
            notesCount > 0
              ? `Контакт удалится вместе с заметками (${notesCount}). Восстановить не получится.`
              : "Восстановить контакт не получится."
          }
          action={deleteContactAction.bind(null, contact.id)}
        >
          <Button
            variant="ghost"
            size="lg"
            className="text-destructive hover:text-destructive -ml-2.5"
          >
            <Trash2 />
            Удалить контакт
          </Button>
        </ConfirmDelete>
      </div>
    </main>
  );
}
