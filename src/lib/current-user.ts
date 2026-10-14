import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "@/lib/auth";

export type CurrentUser = { id: string; email: string };

/** Who is logged in on this device, or null. Asked once per request, however often it is called. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // First, so a page is never drawn ahead of time at build: it depends on who asks.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    // A page is drawn by the server, which cannot set cookies: the login is renewed by the browser
    // instead (see SessionRefresh).
    query: { disableRefresh: true },
  });
  return session ? { id: session.user.id, email: session.user.email } : null;
});

/** For pages: whoever is not logged in goes to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For server actions: whoever is not logged in (the login ended while the page was open) goes to
 * the login page. Returns null when the login could not be checked, e.g. the database did not
 * answer: the action then gives its own "could not save" answer, as it does for any database failure.
 */
export async function userForAction(): Promise<CurrentUser | null> {
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Failed to check the login", error);
    return null;
  }
  if (!user) redirect("/login");
  return user;
}

/**
 * For the header of every page: who is logged in, or null. A database failure is not an error
 * here: the page still opens (the login page must), only without the email in the header.
 */
export async function getHeaderUser(): Promise<CurrentUser | null> {
  // Asked outside the try: a page that depends on the request must not be drawn ahead of time.
  await headers();
  try {
    return await getCurrentUser();
  } catch (error) {
    console.error("Failed to check the login for the header", error);
    return null;
  }
}
