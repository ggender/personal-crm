import { cn } from "@/lib/utils";
import { avatarHue, initials } from "@/lib/format";

export function ContactAvatar({
  id,
  name,
  className,
}: {
  id: number;
  name: string;
  className?: string;
}) {
  const hue = avatarHue(id);
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        "bg-[oklch(0.93_0.04_var(--hue))] text-[oklch(0.4_0.09_var(--hue))]",
        "dark:bg-[oklch(0.32_0.05_var(--hue))] dark:text-[oklch(0.9_0.05_var(--hue))]",
        className,
      )}
      style={{ "--hue": hue } as React.CSSProperties}
    >
      {initials(name)}
    </span>
  );
}
