import type { Metadata } from "next";

import { createContact } from "@/app/actions";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Новый контакт",
};

export default async function NewContactPage({
  searchParams,
}: PageProps<"/contacts/new">) {
  const params = await searchParams;
  // Prefilled from the "add as a new contact" link on an empty search result.
  const name = typeof params.name === "string" ? params.name : "";

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Новый контакт</CardTitle>
      </CardHeader>
      <CardContent>
        <ContactForm
          action={createContact}
          initialValues={{ name, about: "", howWeMet: "", phone: "", email: "" }}
          submitLabel="Добавить контакт"
          cancelHref="/"
        />
      </CardContent>
    </Card>
  );
}
