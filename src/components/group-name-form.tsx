"use client";

import { useActionState } from "react";

import type { GroupFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GROUP_NAME_MAX = 50;

type GroupNameFormProps = {
  action: (state: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  /** Text of the field when the form opens, e.g. the current name when renaming. */
  initialName?: string;
  submitLabel: string;
  pendingLabel: string;
  /** Names the field for screen readers and is its placeholder. */
  label: string;
  /** Called after a successful save. */
  onSaved?: () => void;
  /** When set, a "Отмена" button and the Escape key call it. */
  onCancel?: () => void;
  autoFocus?: boolean;
  errorId: string;
};

/** A one-field form for a group name: a new group or a rename. Errors show under the field. */
export function GroupNameForm({
  action,
  initialName,
  submitLabel,
  pendingLabel,
  label,
  onSaved,
  onCancel,
  autoFocus,
  errorId,
}: GroupNameFormProps) {
  const [state, formAction, pending] = useActionState<GroupFormState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (!result.error) onSaved?.();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="name"
          autoFocus={autoFocus}
          maxLength={GROUP_NAME_MAX}
          // After a failed save the form is reset: the typed name must come back into the field.
          defaultValue={state.name ?? initialName}
          placeholder={label}
          aria-label={label}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          autoComplete="off"
          className="min-w-0 flex-1 sm:max-w-xs"
          onKeyDown={(event) => {
            if (event.key === "Escape" && onCancel && !pending) {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
      {state.error && (
        <p id={errorId} role="alert" className="text-14 text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
