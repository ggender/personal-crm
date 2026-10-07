"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useEffectEvent, useOptimistic, useRef, useState, useTransition } from "react";

import type { SaveResult } from "@/app/actions";
import {
  CONTACT_FREQUENCIES,
  CONTACT_FREQUENCY_LABELS,
  type ContactFrequency,
  NO_FREQUENCY_LABEL,
} from "@/lib/keep-in-touch";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ContactFrequency | null; label: string }[] = [
  { value: null, label: NO_FREQUENCY_LABEL },
  ...CONTACT_FREQUENCIES.map((value) => ({ value, label: CONTACT_FREQUENCY_LABELS[value] })),
];

type ContactFrequencyPickerProps = {
  frequency: ContactFrequency | null;
  action: (frequency: ContactFrequency | null) => Promise<SaveResult>;
  /** Id of the element that names the group. */
  labelledBy: string;
};

/**
 * Native radio buttons styled as pills: arrow keys and screen readers work out of the box.
 * A choice is saved at once; on failure the previous one comes back by itself.
 */
export function ContactFrequencyPicker({
  frequency,
  action,
  labelledBy,
}: ContactFrequencyPickerProps) {
  const [selected, setSelected] = useOptimistic(frequency);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const groupRef = useRef<HTMLDivElement>(null);

  function pick(value: ContactFrequency | null) {
    setError(undefined);
    startTransition(async () => {
      setSelected(value);
      const result = await action(value);
      if (result.error) setError(result.error);
    });
  }

  // A tap before the page has finished loading checks a radio without saving it, and React keeps
  // that checked radio. Save it now, or the pill would look unselected and ignore further taps.
  const saveEarlyTap = useEffectEvent(() => {
    const input = groupRef.current?.querySelector<HTMLInputElement>("input:checked");
    const option = OPTIONS.find(({ value }) => (value ?? "") === input?.value);
    if (option && option.value !== selected) pick(option.value);
  });
  useEffect(() => saveEarlyTap(), []);

  return (
    <>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={labelledBy}
        className="flex flex-wrap gap-2"
      >
        {OPTIONS.map(({ value, label }) => {
          const checked = selected === value;
          return (
            <label
              key={label}
              className={cn(
                "relative inline-flex h-11 cursor-pointer items-center rounded-full border px-4 text-14 font-medium whitespace-nowrap transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent sm:h-10",
                checked
                  ? "border-ink bg-ink font-semibold text-bg"
                  : "border-line-strong bg-surface hover:bg-strip",
              )}
            >
              <input
                type="radio"
                name="contact-frequency"
                value={value ?? ""}
                checked={checked}
                onChange={() => pick(value)}
                // The saved choice comes from the server: the browser must not restore its own on reload.
                autoComplete="off"
                className="sr-only"
              />
              {label}
            </label>
          );
        })}
      </div>
      <div aria-live="polite">
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-12 bg-note px-3 py-2.5 text-15 font-medium text-destructive">
            <CircleAlert className="mt-px size-4.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </>
  );
}
