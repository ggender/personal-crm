import type { Metadata } from "next";

import { createContactAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "Новый контакт" };

export default async function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  const { name } = await searchParams;

  return (
    <main className="page-container pt-4 pb-16">
      <BackLink href="/">Все контакты</BackLink>
      <h1 className="mt-5 mb-6 font-serif text-26 font-medium sm:text-h2">Новый контакт</h1>
      <ContactForm
        action={createContactAction}
        initialValues={{ name: typeof name === "string" ? name : "" }}
        submitLabel="Сохранить контакт"
        cancelHref="/"
        withFirstNote
      />
    </main>
  );
}
