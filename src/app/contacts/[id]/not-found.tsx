import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ContactNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Контакт не найден</h1>
      <p className="text-muted-foreground">Возможно, ссылка устарела или в ней опечатка.</p>
      <Button asChild>
        <Link href="/">К списку контактов</Link>
      </Button>
    </main>
  );
}
