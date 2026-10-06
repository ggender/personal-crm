import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "Новый контакт" };

export default async function NewContactPage({ searchParams }: PageProps<"/contacts/new">) {
  const { name } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Все контакты
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новый контакт</h1>
      <ContactForm defaultName={typeof name === "string" ? name : undefined} />
    </main>
  );
}
