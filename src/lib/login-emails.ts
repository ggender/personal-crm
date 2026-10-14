import "server-only";

import { and, eq, lt, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { loginEmails, verifications } from "@/db/schema";

/** At most this many emails to one address in any `LOGIN_EMAIL_WINDOW_MINUTES` minutes. */
export const LOGIN_EMAIL_LIMIT = 3;
export const LOGIN_EMAIL_WINDOW_MINUTES = 10;

/** Thrown when the address has used up its emails: nothing was sent. */
export class LoginEmailLimitError extends Error {
  constructor() {
    super("Too many login emails for this address");
    this.name = "LoginEmailLimitError";
  }
}

/** The part of `verifications.identifier` in front of the fingerprint of a login link. */
export const LOGIN_LINK_PREFIX = "magic-link:";

// The address a stored link belongs to. The CASE keeps the JSON cast away from other rows.
const linkEmail = sql`case when ${verifications.identifier} like ${`${LOGIN_LINK_PREFIX}%`}
  then ${verifications.value}::jsonb ->> 'email' end`;

/**
 * Sends the email for a login link that Better Auth has just created and stored, under the rules:
 * - an address gets no more than 3 emails in 10 minutes; the 4th request sends nothing;
 * - once the email has gone out, all other unused links of this address stop working;
 * - only emails that really went out are counted and cancel older links.
 * A refused or failed request leaves the links that came before untouched and removes the new one,
 * which nobody has received. `identifier` is the stored key of the new link.
 * The address is locked for the whole run, so two simultaneous requests cannot both send a 4th email.
 */
export async function deliverLoginLink({
  email,
  identifier,
  send,
}: {
  email: string;
  identifier: string;
  send: () => Promise<void>;
}) {
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`login-email:${email}`}))`);

      const [{ sent }] = await tx
        .select({ sent: sql<number>`count(*)`.mapWith(Number) })
        .from(loginEmails)
        .where(
          and(
            eq(loginEmails.email, email),
            sql`${loginEmails.sentAt} > now() - make_interval(mins => ${LOGIN_EMAIL_WINDOW_MINUTES})`,
          ),
        );
      if (sent >= LOGIN_EMAIL_LIMIT) throw new LoginEmailLimitError();

      await send();

      await tx
        .delete(verifications)
        .where(and(eq(linkEmail, email), sql`${verifications.identifier} <> ${identifier}`));
      await tx.insert(loginEmails).values({ email });
      // The count looks back 10 minutes; a day of history is plenty and the table stays small.
      await tx.delete(loginEmails).where(lt(loginEmails.sentAt, sql`now() - interval '1 day'`));
    });
  } catch (error) {
    await db
      .delete(verifications)
      .where(eq(verifications.identifier, identifier))
      .catch((cleanupError) =>
        console.error("Failed to remove an unsent login link", cleanupError),
      );
    throw error;
  }
}
