"use client";

import { useActionState } from "react";

import type { NoteFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type NoteFormProps = {
  action: (previous: NoteFormState, formData: FormData) => Promise<NoteFormState>;
};

export function NoteForm({ action }: NoteFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-2">
      <Label htmlFor="note-body">Новая заметка</Label>
      <Textarea
        id="note-body"
        name="body"
        rows={3}
        required
        // On success the form resets to empty; on error the typed text is kept.
        defaultValue={state.body ?? ""}
        placeholder="О чём поговорили, о чём договорились"
        aria-invalid={state.error ? true : undefined}
        className="min-h-24"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохраняю…" : "Сохранить заметку"}
        </Button>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          или ⌘/Ctrl + Enter
        </span>
      </div>
    </form>
  );
}
