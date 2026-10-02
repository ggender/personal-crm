import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateContact } from "@/app/actions";
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
    <Card className="mx-auto w-full max-w-2xl">
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
  );
}
