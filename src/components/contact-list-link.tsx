import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { cn } from "@/lib/utils";

type ContactListLinkProps = {
  id: number;
  name: string;
  /** Lines under the name. */
  children?: React.ReactNode;
  /** Shown at the right edge, e.g. the phone number. */
  aside?: React.ReactNode;
  /** The contact that was just added. */
  highlighted?: boolean;
  className?: string;
};

/** A contact in a list: avatar and name, a link to the contact page. */
export function ContactListLink({
  id,
  name,
  children,
  aside,
  highlighted,
  className,
}: ContactListLinkProps) {
  return (
    <Link
      href={`/contacts/${id}`}
      className={cn(
        "flex items-center gap-3 rounded-12 px-2.5 py-2.5 transition-colors hover:bg-strip/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        highlighted && "bg-note ring-2 ring-accent/50 ring-inset hover:bg-note",
        className,
      )}
    >
      <ContactAvatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-17 font-medium">{name}</p>
        {children}
      </div>
      {aside}
    </Link>
  );
}
