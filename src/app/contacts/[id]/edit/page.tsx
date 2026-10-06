import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { deleteContactAction, updateContactAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
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
    <main className="page-container pt-4 pb-16">
      <BackLink href={`/contacts/${contact.id}`}>К карточке</BackLink>
      <h1 className="mt-5 mb-6 font-serif text-26 font-medium sm:text-h2">Изменить контакт</h1>
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
      <div className="mt-10 border-t border-line pt-6">
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
            className="-ml-2.5 text-destructive hover:text-destructive"
          >
            <Trash2 />
            Удалить контакт
          </Button>
        </ConfirmDelete>
      </div>
    </main>
  );
}
