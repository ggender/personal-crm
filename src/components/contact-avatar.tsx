import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ContactAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-strip font-serif text-15 font-medium text-muted",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
