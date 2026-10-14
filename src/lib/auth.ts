import "server-only";

import { createHash } from "node:crypto";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { getDb } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { deliverLoginLink, LOGIN_LINK_PREFIX } from "@/lib/login-emails";
import { LOGIN_LINK_MINUTES, sendLoginEmail } from "@/lib/mail";
import { LOGIN_EMAIL_ERROR, loginEmailSchema } from "@/lib/validation";

const DAY = 60 * 60 * 24;

/** Error codes the login form turns into messages. */
export const LOGIN_ERROR = {
  invalidEmail: "INVALID_EMAIL",
  tooOften: "LOGIN_EMAIL_LIMIT",
} as const;

/** What is stored in the database instead of a login link: the link itself is never kept. */
const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run \`pnpm env:init\` to create .env.`);
  return value;
}

function createAuth() {
  return betterAuth({
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: requireEnv("BETTER_AUTH_URL"),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    advanced: { database: { generateId: "uuid" } },
    // 30 days from the last visit; a visit renews the login, but not more often than once a day.
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    // The only limit is "3 emails per address in 10 minutes" (src/lib/login-emails.ts): the owner
    // decided against limits by IP address.
    rateLimit: { enabled: false },
    hooks: {
      // One place that checks the email, for the form and for requests that skip the form.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/magic-link") return;
        const email = loginEmailSchema.safeParse(ctx.body?.email);
        if (!email.success) {
          throw new APIError("BAD_REQUEST", {
            code: LOGIN_ERROR.invalidEmail,
            message: LOGIN_EMAIL_ERROR,
          });
        }
        return { context: { ...ctx, body: { ...ctx.body, email: email.data } } };
      }),
    },
    plugins: [
      magicLink({
        expiresIn: LOGIN_LINK_MINUTES * 60,
        storeToken: { type: "custom-hasher", hash: async (token) => fingerprint(token) },
        sendMagicLink: async ({ email, url, token }) => {
          try {
            await deliverLoginLink({
              email,
              identifier: `${LOGIN_LINK_PREFIX}${fingerprint(token)}`,
              send: () => sendLoginEmail({ to: email, url }),
            });
          } catch (error) {
            if (error instanceof Error && error.name === "LoginEmailLimitError") {
              throw new APIError("TOO_MANY_REQUESTS", {
                code: LOGIN_ERROR.tooOften,
                message: error.message,
              });
            }
            throw error;
          }
        },
      }),
      // Last: it lets the server actions set the login cookie.
      nextCookies(),
    ],
  });
}

// Created on the first use, like the database pool: `next build` loads the modules without the
// settings, and creating this on load would stop the build of the image.
const globalForAuth = globalThis as unknown as { auth?: ReturnType<typeof createAuth> };

export function getAuth() {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
