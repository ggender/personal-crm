"use client";

import { Pencil } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import type { NoteFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type NoteAction = (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;

type NoteItemProps = {
  body: string;
  /** Rendered on the server, so the date is formatted in one place and time zone. */
  time: React.ReactNode;
  updateAction: NoteAction;
};

export function NoteItem({ body, time, updateAction }: NoteItemProps) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="rounded-14 bg-note px-4 pt-2.5 pb-4">
      <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
        {time}
        {!editing && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-2 text-subtle hover:text-ink"
            aria-label="Изменить заметку"
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
        )}
      </div>
      {editing ? (
        <NoteEditForm body={body} action={updateAction} onDone={() => setEditing(false)} />
      ) : (
        <p className="text-memo-lg break-words whitespace-pre-wrap text-note-text">{body}</p>
      )}
    </li>
  );
}

function NoteEditForm({
  body,
  action,
  onDone,
}: {
  body: string;
  action: NoteAction;
  onDone: () => void;
}) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (!result.error) onDone();
      return result;
    },
    {},
  );

  useEffect(() => {
    // Start typing at the end of the existing text.
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  return (
    <form action={formAction} className="grid gap-3">
      <Label htmlFor={id} className="sr-only">
        Текст заметки
      </Label>
      <Textarea
        ref={textareaRef}
        id={id}
        name="body"
        rows={3}
        maxLength={5000}
        defaultValue={state.body ?? body}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? `${id}-error` : undefined}
        className="min-h-24"
        onKeyDown={(event) => {
          // Same shortcut as for a new note; Escape leaves without saving.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          } else if (event.key === "Escape" && !pending) {
            event.preventDefault();
            onDone();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
          Отмена
        </Button>
        {state.error && (
          <span id={`${id}-error`} role="alert" className="text-14 text-destructive">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
