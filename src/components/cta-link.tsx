import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Main action of a screen, styled like the landing's call to action: dark button, accent square. */
export function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild size="cta" className="max-w-full">
      <Link href={href}>
        <span className="truncate">{children}</span>
        <span
          className="flex size-9 items-center justify-center rounded-10 bg-accent text-surface"
          aria-hidden
        >
          <Plus className="size-5" />
        </span>
      </Link>
    </Button>
  );
}
