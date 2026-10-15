import { Cake } from "lucide-react";

import { ContactListLink } from "@/components/contact-list-link";
import type { listUpcomingBirthdays } from "@/lib/contacts";
import { formatBirthdayWhen } from "@/lib/format";

type UpcomingBirthday = Awaited<ReturnType<typeof listUpcomingBirthdays>>[number];

const TODAY = "Сегодня";

/** "Скоро день рождения" on the home page: today and the next 7 days, the nearest first. */
export function BirthdaysSection({ contacts }: { contacts: UpcomingBirthday[] }) {
  return (
    <section aria-labelledby="birthdays-heading" className="mb-5">
      <h2
        id="birthdays-heading"
        className="flex items-center gap-2 px-4 pb-2 text-label font-medium text-accent-text uppercase"
      >
        <Cake className="size-4" />
        Скоро день рождения · {contacts.length.toLocaleString("ru-RU")}
      </h2>
      {/* Raised with a shadow like "Пора связаться", so the block does not merge with the letters. */}
      <ul className="rounded-16 border border-line-strong bg-surface p-1.5 shadow-card">
        {contacts.map((contact) => {
          const when = formatBirthdayWhen(contact.daysUntil, contact.next, contact.turningAge);
          return (
            <li key={contact.id}>
              <ContactListLink id={contact.id} name={contact.name} className="gap-2.5 sm:gap-3">
                <p className="mt-0.5 text-14 text-muted">
                  {contact.daysUntil === 0 ? (
                    <>
                      <span className="font-medium text-accent-text">{TODAY}</span>
                      {when.slice(TODAY.length)}
                    </>
                  ) : (
                    when
                  )}
                </p>
              </ContactListLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
