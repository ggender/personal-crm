"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";

const SEARCH_DELAY_MS = 250;

// Filters the list as you type by updating ?q= in the address bar; the server
// renders the matching contacts. Without JavaScript it works as a plain GET form.
export function SearchBox({ query }: { query: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSearched = useRef(query);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The query changed without typing (e.g. the header link to "/"): show it in the input.
  useEffect(() => {
    if (query !== lastSearched.current && inputRef.current) {
      lastSearched.current = query;
      inputRef.current.value = query;
    }
  }, [query]);

  function search(value: string) {
    clearTimeout(timer.current);
    const trimmed = value.trim();
    lastSearched.current = trimmed;
    const url = trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/";
    startTransition(() => router.replace(url, { scroll: false }));
  }

  return (
    <form
      action="/"
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        search(inputRef.current?.value ?? "");
      }}
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={query}
        onChange={(event) => {
          const value = event.target.value;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => search(value), SEARCH_DELAY_MS);
        }}
        placeholder="Найти по имени"
        aria-label="Найти контакт по имени"
        autoComplete="off"
        className="h-10 pr-16 pl-9 text-base md:text-base"
      />
      {isPending && (
        <span className="pointer-events-none absolute top-1/2 right-9 -translate-y-1/2 text-xs text-muted-foreground">
          Ищу…
        </span>
      )}
    </form>
  );
}
