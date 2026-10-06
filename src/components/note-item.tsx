"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import type { DeleteResult, NoteFormState } from "@/app/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type NoteAction = (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;

type NoteItemProps = {
  body: string;
  /** Rendered on the server, so the date is formatted in one place and time zone. */
  time: React.ReactNode;
  updateAction: NoteAction;
  deleteAction: () => Promise<DeleteResult>;
};

export function NoteItem({ body, time, updateAction, deleteAction }: NoteItemProps) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="bg-card rounded-xl border p-4">
      <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
        {time}
        {!editing && (
          <div className="-mr-2 flex">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Изменить заметку"
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
            <ConfirmDelete
              title="Удалить заметку?"
              description="Восстановить её не получится."
              action={deleteAction}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Удалить заметку"
              >
                <Trash2 />
              </Button>
            </ConfirmDelete>
          </div>
        )}
      </div>
      {editing ? (
        <NoteEditForm body={body} action={updateAction} onDone={() => setEditing(false)} />
      ) : (
        <p className="break-words whitespace-pre-wrap">{body}</p>
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
        className="min-h-24 text-base"
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
          <span id={`${id}-error`} role="alert" className="text-destructive text-sm">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
