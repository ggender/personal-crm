import type { Metadata } from "next";

import { createGroupAction, deleteGroupAction, renameGroupAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { GroupNameForm } from "@/components/group-name-form";
import { GroupRow } from "@/components/group-row";
import { listGroups } from "@/lib/groups";

export const metadata: Metadata = { title: "Группы" };

export default async function GroupsPage() {
  const groups = await listGroups();

  return (
    <main className="page-container pt-4 pb-16">
      <BackLink href="/">Все контакты</BackLink>
      <h1 className="mt-5 mb-6 font-serif text-26 font-medium sm:text-h2">Группы</h1>

      <section aria-labelledby="new-group-heading" className="mb-8">
        <h2
          id="new-group-heading"
          className="mb-3 text-label font-medium text-accent-text uppercase"
        >
          Новая группа
        </h2>
        <GroupNameForm
          action={createGroupAction}
          label="Название группы"
          submitLabel="Добавить"
          pendingLabel="Добавляю…"
          errorId="create-group-error"
        />
      </section>

      {groups.length === 0 ? (
        <p className="text-15 text-muted">
          Групп пока нет. Заведите первую — например, «Семья», «Друзья» или «Коллеги».
        </p>
      ) : (
        <ul className="rounded-16 border border-line bg-surface p-1.5">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              id={group.id}
              name={group.name}
              contactCount={group.contactCount}
              renameAction={renameGroupAction.bind(null, group.id)}
              deleteAction={deleteGroupAction.bind(null, group.id)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
