import "server-only";

import { createTransport, type Transporter } from "nodemailer";

/** How long a login link works, in minutes. The email says it, the link itself expires then. */
export const LOGIN_LINK_MINUTES = 15;

// Mail clients do not understand CSS variables, so the email repeats the values of the tokens in
// src/styles/tokens.css here, in one place.
const COLORS = {
  bg: "#f5efe6",
  surface: "#fffaf3",
  ink: "#2a211b",
  muted: "#6d5f53",
  accent: "#c2562f",
  line: "#e6dccd",
};

let transport: Transporter | undefined;

// Created on the first email, not on load: `next build` loads the modules without the settings.
function getTransport() {
  const url = process.env.SMTP_URL;
  if (!url) throw new Error("SMTP_URL is not set. Run `pnpm env:init` to create .env.");
  // Timeouts, so a mail server that does not answer does not hang the request for minutes.
  transport ??= createTransport({
    url,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SUBJECT = "Вход в Личную CRM";
const EXPIRY = `Ссылка работает ${LOGIN_LINK_MINUTES} минут.`;
const IGNORE = "Если вы не запрашивали вход - просто проигнорируйте письмо";

function loginEmailText(url: string) {
  return [`Чтобы войти в Личную CRM, откройте ссылку:`, url, "", EXPIRY, IGNORE, ""].join("\n");
}

function loginEmailHtml(url: string) {
  const href = escapeHtml(url);
  const font = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px 12px;background:${COLORS.bg};font-family:${font};color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:16px;">
      <tr>
        <td style="padding:32px 28px;">
          <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:20px;font-style:italic;color:${COLORS.ink};"><span style="color:${COLORS.accent};">&#9679;</span> Личная CRM</p>
          <p style="margin:24px 0;font-size:16px;line-height:1.5;">Чтобы войти, нажмите кнопку.</p>
          <p style="margin:0 0 24px;">
            <a href="${href}" style="display:inline-block;padding:12px 28px;border-radius:12px;background:${COLORS.ink};color:${COLORS.surface};font-size:16px;font-weight:600;text-decoration:none;">Войти</a>
          </p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${COLORS.muted};">${EXPIRY}</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:${COLORS.muted};">${IGNORE}</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted};word-break:break-all;">Кнопка не работает? Откройте ссылку: ${href}</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** Sends the email with the login link. Throws when the mail service does not take the email. */
export async function sendLoginEmail({ to, url }: { to: string; url: string }) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM is not set. Run `pnpm env:init` to create .env.");
  await getTransport().sendMail({
    from,
    to,
    subject: SUBJECT,
    text: loginEmailText(url),
    html: loginEmailHtml(url),
  });
}
