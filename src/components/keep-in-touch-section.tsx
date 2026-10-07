import { Check, Clock } from "lucide-react";

import { markContactedAction, undoContactedAction } from "@/app/actions";
import { ContactListLink } from "@/components/contact-list-link";
import { ContactedButton } from "@/components/contacted-button";
import type { listOverdueContacts } from "@/lib/contacts";
import { formatOverdue } from "@/lib/format";
import { CONTACT_FREQUENCY_LABELS } from "@/lib/keep-in-touch";

type OverdueContact = Awaited<ReturnType<typeof listOverdueContacts>>[number];

/** "Пора связаться" on the home page: everyone not reached for longer than their frequency. */
export function KeepInTouchSection({ contacts }: { contacts: OverdueContact[] }) {
  return (
    <section aria-labelledby="keep-in-touch-heading" className="mb-5">
      <h2
        id="keep-in-touch-heading"
        className="flex items-center gap-2 px-4 pb-2 text-label font-medium text-accent-text uppercase"
      >
        <Clock className="size-4" />
        Пора связаться · {contacts.length.toLocaleString("ru-RU")}
      </h2>
      {/* Raised with a shadow so the block does not merge with the letter groups below. */}
      <ul className="rounded-16 border border-line-strong bg-surface p-1.5 shadow-card">
        {contacts.map((contact) => (
          // The link and the button sit side by side: pressing the button never opens the contact.
          // While ContactedButton shows "Отменить" it puts data-marked in the row, which switches
          // the line under the name to "Отмечено".
          <li
            key={contact.id}
            className="group/row flex flex-wrap items-center gap-1 rounded-12 pr-1 has-data-marked:bg-note sm:gap-2 sm:pr-2"
          >
            <ContactListLink
              id={contact.id}
              name={contact.name}
              className="min-w-0 flex-1 gap-2.5 sm:gap-3"
            >
              <p className="mt-0.5 text-14 text-muted group-has-data-marked/row:hidden">
                {CONTACT_FREQUENCY_LABELS[contact.frequency]} ·{" "}
                {/* inline-block: on a narrow screen the line breaks after "·" first. */}
                <span className="inline-block font-medium text-accent-text">
                  {formatOverdue(contact.overdueDays)}
                </span>
              </p>
              <p className="mt-0.5 hidden items-center gap-1.5 text-14 font-medium group-has-data-marked/row:flex">
                <Check className="size-4 text-accent" strokeWidth={2.5} />
                Отмечено
              </p>
            </ContactListLink>
            <ContactedButton
              mode="row"
              markAction={markContactedAction.bind(null, contact.id)}
              undoAction={undoContactedAction.bind(null, contact.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
