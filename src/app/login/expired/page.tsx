import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ссылка устарела" };

// Every link that cannot log in lands here: used, too old, cancelled by a newer one, or broken.
// Better Auth adds the reason to the address (?error=...); it is for the server log, not for the page.
export default function LoginLinkExpiredPage() {
  return (
    <main className="page-container pt-10 pb-16">
      <div className="mx-auto max-w-sm">
        <h1 className="mb-6 font-serif text-26 font-medium text-balance sm:text-h2">
          Ссылка устарела, запросите новую
        </h1>
        <Button asChild size="lg">
          <Link href="/login">На страницу входа</Link>
        </Button>
      </div>
    </main>
  );
}
