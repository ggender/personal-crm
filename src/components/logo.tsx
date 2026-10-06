import Link from "next/link";

/** Same mark as on the landing: accent dot and the product name in italic serif. */
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-10 font-serif text-20 font-medium italic focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="block size-2.5 rounded-full bg-accent" aria-hidden />
      Личная CRM
    </Link>
  );
}
