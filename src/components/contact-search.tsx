"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";
import type { GroupFilter } from "@/lib/contacts";
import { contactsHref } from "@/lib/group-filter";

const DEBOUNCE_MS = 200;

export function ContactSearch({
  defaultValue,
  filter,
}: {
  defaultValue: string;
  /** The chosen group: a search stays inside it. */
  filter: GroupFilter;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function search(value: string) {
    window.clearTimeout(timer.current);
    const query = value.trim();
    const href = contactsHref({ filter, query });
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
      {filter.kind !== "all" && (
        <input
          type="hidden"
          name="group"
          value={filter.kind === "group" ? filter.groupId : "none"}
        />
      )}
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-accent" />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Найти по имени"
        aria-label="Найти контакт по имени"
        autoComplete="off"
        className="h-12 rounded-14 border-line pr-11 pl-11"
        onChange={(event) => {
          const value = event.target.value;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => search(value), DEBOUNCE_MS);
        }}
      />
      {isPending && (
        <LoaderCircle
          aria-label="Ищу…"
          className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-subtle"
        />
      )}
    </form>
  );
}
