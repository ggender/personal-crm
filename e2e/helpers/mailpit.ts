// Reads the emails the app sent from Mailpit (the mail stub in Docker; a service in CI).
// Every test writes to its own one-time address and looks only at that address, so tests never
// touch each other's emails.
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

export const MAILPIT_PAGE_URL = MAILPIT_URL;

type MailpitSummary = { ID: string; Created: string; Subject: string };

export type MailMessage = {
  id: string;
  subject: string;
  from: { name: string; address: string };
  to: string[];
  text: string;
  html: string;
};

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}/api/v1${path}`);
  if (!response.ok) throw new Error(`Mailpit answered ${response.status} for ${path}`);
  return (await response.json()) as T;
}

/** All emails to this address, newest first, with their text and HTML. */
export async function messagesTo(address: string): Promise<MailMessage[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const { messages } = await api<{ messages: MailpitSummary[] }>(`/search?query=${query}&limit=50`);
  return Promise.all(
    messages.map(async ({ ID }) => {
      const full = await api<{
        ID: string;
        Subject: string;
        From: { Name: string; Address: string };
        To: { Address: string }[];
        Text: string;
        HTML: string;
      }>(`/message/${ID}`);
      return {
        id: full.ID,
        subject: full.Subject,
        from: { name: full.From.Name, address: full.From.Address },
        to: full.To.map((recipient) => recipient.Address),
        text: full.Text,
        html: full.HTML,
      };
    }),
  );
}

/** How many emails Mailpit holds in total: to check that a request sent nothing at all. */
export async function totalMessages() {
  const { total } = await api<{ total: number }>("/messages?limit=1");
  return total;
}

const LOGIN_LINK = /https?:\/\/[^\s<>"]+\/api\/auth\/magic-link\/verify\?[^\s<>"]+/;

/** The login link in the text part of an email. */
export function loginLinkIn(message: MailMessage) {
  const link = LOGIN_LINK.exec(message.text)?.[0];
  if (!link) throw new Error(`No login link in the email "${message.subject}"`);
  return link;
}

/** Login links sent to this address, newest first. */
export async function loginLinksTo(address: string) {
  return (await messagesTo(address)).map(loginLinkIn);
}
