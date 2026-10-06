import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ContactNotFound() {
  return (
    <main className="page-container flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="font-serif text-26 font-medium sm:text-h2">Контакт не найден</h1>
      <p className="text-16 text-muted">Возможно, ссылка устарела или в ней опечатка.</p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">К списку контактов</Link>
      </Button>
    </main>
  );
}
