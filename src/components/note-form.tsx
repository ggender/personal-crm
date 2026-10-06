"use client";

import { CircleCheck } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import type { NoteFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SAVED_MESSAGE_MS = 4000;

export function NoteForm({
  action,
}: {
  action: (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // The "saved" message is shown for the latest save until its timer hides it.
  const [hiddenSavedAt, setHiddenSavedAt] = useState<number>();
  const showSaved = state.savedAt !== undefined && state.savedAt !== hiddenSavedAt;

  useEffect(() => {
    const savedAt = state.savedAt;
    if (savedAt === undefined) return;
    const timer = window.setTimeout(() => setHiddenSavedAt(savedAt), SAVED_MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [state.savedAt]);

  return (
    <form action={formAction} className="grid gap-3">
      <Label htmlFor="note-body" className="sr-only">
        Новая заметка
      </Label>
      <Textarea
        id="note-body"
        name="body"
        rows={3}
        maxLength={5000}
        defaultValue={state.body}
        placeholder="Что обсудили, о чём договорились…"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "note-error" : undefined}
        className="min-h-24"
        onKeyDown={(event) => {
          // Cmd/Ctrl + Enter saves the note without reaching for the mouse.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняю…" : "Добавить заметку"}
        </Button>
        <span aria-live="polite" className="text-14">
          {state.error ? (
            <span id="note-error" className="text-destructive">
              {state.error}
            </span>
          ) : (
            showSaved && (
              <span className="inline-flex items-center gap-1.5 text-accent-text">
                <CircleCheck className="size-4" />
                Заметка сохранена
              </span>
            )
          )}
        </span>
        <span className="ml-auto hidden text-13 text-subtle sm:inline">
          ⌘/Ctrl + Enter — сохранить
        </span>
      </div>
    </form>
  );
}
