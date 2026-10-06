"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 200;

export function ContactSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function search(value: string) {
    window.clearTimeout(timer.current);
    const query = value.trim();
    const href = query ? `/?q=${encodeURIComponent(query)}` : "/";
    startTransition(() => router.replace(href, { scroll: false }));
  }

  return (
    // Plain GET form keeps search working even before JavaScript loads.
    <form
      action="/"
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        search(new FormData(event.currentTarget).get("q")?.toString() ?? "");
      }}
    >
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Найти по имени"
        aria-label="Найти контакт по имени"
        autoComplete="off"
        className="h-11 pr-10 pl-9 text-base"
        onChange={(event) => {
          const value = event.target.value;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => search(value), DEBOUNCE_MS);
        }}
      />
      {isPending && (
        <LoaderCircle
          aria-label="Ищу…"
          className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
        />
      )}
    </form>
  );
}
