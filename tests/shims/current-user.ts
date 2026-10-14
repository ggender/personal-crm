// Test stand-in for "@/lib/current-user". The tests call the data functions and the server
// actions outside a Next.js request, so there is no cookie to read: a test says who is logged in
// with signInAs(). The real module is covered by the browser tests (e2e/).
// Only used via vitest.config.mts.
export type CurrentUser = { id: string; email: string };

let current: CurrentUser | null = null;

/** The next calls act on behalf of this user. */
export function signInAs(id: string, email = "user@example.test") {
  current = { id, email };
}

export function signOut() {
  current = null;
}

export async function getCurrentUser() {
  return current;
}

function loggedIn() {
  // The real module sends a visitor without login to the login page; a test must not get here.
  if (!current) throw new Error("Nobody is logged in: call signInAs() first.");
  return current;
}

export async function requireUser() {
  return loggedIn();
}

export async function userForAction() {
  return loggedIn();
}
