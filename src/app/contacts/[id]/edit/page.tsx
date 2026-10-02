import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { deleteContact, updateContact } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContact, parseContactId } from "@/lib/contacts";

export const metadata: Metadata = {
  title: "Изменить контакт",
};

export default async function EditContactPage({
  params,
}: PageProps<"/contacts/[id]/edit">) {
  const id = parseContactId((await params).id);
  const contact = id ? await getContact(id) : null;
  if (!contact) notFound();

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Изменить контакт</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm
            action={updateContact.bind(null, contact.id)}
            initialValues={{
              name: contact.name,
              about: contact.about ?? "",
              howWeMet: contact.howWeMet ?? "",
              phone: contact.phone ?? "",
              email: contact.email ?? "",
            }}
            submitLabel="Сохранить"
            cancelHref={`/contacts/${contact.id}`}
          />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground">
            Удалить контакт вместе со всеми заметками
          </p>
          <ConfirmDeleteButton
            action={deleteContact.bind(null, contact.id)}
            title={`Удалить контакт «${contact.name}»?`}
            description="Контакт и все заметки к нему удалятся навсегда, вернуть их не получится."
            confirmLabel="Удалить контакт"
            trigger="Удалить контакт"
            triggerProps={{ variant: "destructive" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
