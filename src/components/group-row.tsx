"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { DeleteResult, GroupFormState } from "@/app/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { GroupNameForm } from "@/components/group-name-form";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { contactsHref } from "@/lib/group-filter";

const CONTACT_WORDS: [string, string, string] = ["контакт", "контакта", "контактов"];

type GroupRowProps = {
  id: number;
  name: string;
  contactCount: number;
  renameAction: (state: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  deleteAction: () => Promise<DeleteResult>;
};

/** A group on the "Группы" page: its name opens the people in it; rename and delete sit aside. */
export function GroupRow({ id, name, contactCount, renameAction, deleteAction }: GroupRowProps) {
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <li className="rounded-12 bg-strip/60 px-3 py-3">
        <GroupNameForm
          action={renameAction}
          initialName={name}
          label="Название группы"
          submitLabel="Сохранить"
          pendingLabel="Сохраняю…"
          errorId={`group-${id}-error`}
          autoFocus
          onSaved={() => setRenaming(false)}
          onCancel={() => setRenaming(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-12 px-3 py-2 hover:bg-strip/60">
      <Link
        href={contactsHref({ filter: { kind: "group", groupId: id }, query: "" })}
        className="min-w-0 flex-1 rounded-10 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="block truncate font-serif text-17 font-medium">{name}</span>
        <span className="block text-14 text-subtle">{plural(contactCount, CONTACT_WORDS)}</span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="text-subtle hover:text-ink"
        aria-label={`Переименовать «${name}»`}
        onClick={() => setRenaming(true)}
      >
        <Pencil />
      </Button>
      <ConfirmDelete
        title={`Удалить группу «${name}»?`}
        description="Люди останутся в контактах, пропадёт только группа."
        action={deleteAction}
      >
        <Button
          variant="ghost"
          size="icon"
          className="text-subtle hover:text-destructive"
          aria-label={`Удалить «${name}»`}
        >
          <Trash2 />
        </Button>
      </ConfirmDelete>
    </li>
  );
}
