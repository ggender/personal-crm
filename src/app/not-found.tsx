import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid justify-items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Такой страницы нет</h1>
      <p className="text-muted-foreground">
        Возможно, контакт не существует или в адресе опечатка.
      </p>
      <Link href="/" className={buttonVariants()}>
        К списку контактов
      </Link>
    </div>
  );
}
