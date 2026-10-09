"use client";

import { Check, CircleAlert, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useOptimistic, useRef, useState, useTransition } from "react";

import type { GroupFormState, SaveResult } from "@/app/actions";
import { GroupNameForm } from "@/components/group-name-form";
import { GROUPS_PAGE_HREF } from "@/lib/group-filter";
import { cn } from "@/lib/utils";

type ContactGroupsPickerProps = {
  groups: { id: number; name: string }[];
  /** Ids of the groups this contact is in. */
  selectedIds: number[];
  setAction: (groupId: number, member: boolean) => Promise<SaveResult>;
  createAction: (state: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  /** Id of the element that names the group. */
  labelledBy: string;
};

/**
 * Native checkboxes styled as pills, like the frequency picker: a press is saved at once; on
 * failure the pill goes back by itself. A new group can be started right here.
 */
export function ContactGroupsPicker({
  groups,
  selectedIds,
  setAction,
  createAction,
  labelledBy,
}: ContactGroupsPickerProps) {
  const [selected, setSelected] = useOptimistic(
    selectedIds,
    (current, change: { id: number; member: boolean }) =>
      change.member
        ? [...current.filter((id) => id !== change.id), change.id]
        : current.filter((id) => id !== change.id),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  function toggle(id: number, member: boolean) {
    setError(undefined);
    startTransition(async () => {
      setSelected({ id, member });
      const result = await setAction(id, member);
      if (result.error) setError(result.error);
    });
  }

  // A tap before the page has finished loading flips a checkbox without saving it, and React keeps
  // that state. Save such taps now, or the pill would look checked without being saved.
  const saveEarlyTaps = useEffectEvent(() => {
    const inputs = rowRef.current?.querySelectorAll<HTMLInputElement>("input[data-group-id]") ?? [];
    for (const input of inputs) {
      const id = Number(input.dataset.groupId);
      if (input.checked !== selected.includes(id)) toggle(id, input.checked);
    }
  });
  useEffect(() => saveEarlyTaps(), []);

  return (
    <>
      {groups.length === 0 && <p className="mb-2 text-15 text-muted">Групп пока нет</p>}
      <div
        ref={rowRef}
        role="group"
        aria-labelledby={labelledBy}
        className="flex flex-wrap items-center gap-2"
      >
        {groups.map((group) => {
          const checked = selected.includes(group.id);
          return (
            <label
              key={group.id}
              className={cn(
                "relative inline-flex h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-4 text-14 font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent sm:h-10",
                checked
                  ? "border-ink bg-ink font-semibold text-bg"
                  : "border-line-strong bg-surface hover:bg-strip",
              )}
            >
              <input
                type="checkbox"
                data-group-id={group.id}
                checked={checked}
                onChange={(event) => toggle(group.id, event.target.checked)}
                // The saved choice comes from the server: the browser must not restore its own.
                autoComplete="off"
                className="sr-only"
              />
              {checked && <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />}
              <span className="truncate">{group.name}</span>
            </label>
          );
        })}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-4 text-14 font-medium text-muted transition-colors hover:bg-strip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-10"
          >
            <Plus className="size-4" />
            Новая группа
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3">
          <GroupNameForm
            action={createAction}
            label="Название группы"
            submitLabel="Добавить"
            pendingLabel="Добавляю…"
            errorId="new-group-error"
            autoFocus
            onSaved={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-12 bg-note px-3 py-2.5 text-15 font-medium text-destructive">
            <CircleAlert className="mt-px size-4.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <Link
        href={GROUPS_PAGE_HREF}
        className="mt-3 inline-block text-14 text-accent-text underline underline-offset-4"
      >
        Настроить группы
      </Link>
    </>
  );
}
