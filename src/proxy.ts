import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/*
 * A quick check without the database: no login cookie - to the login page. This is not the
 * protection (a stale cookie passes): every page asks requireUser() and every data function takes
 * the user id. The quick check only saves a visitor a round trip.
 */
export function proxy(request: NextRequest) {
  // A server action checks the login itself and answers properly; a redirect would break it.
  if (request.headers.has("next-action")) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  // The public address from the settings: behind nginx the app sees its own host and http only.
  return NextResponse.redirect(new URL("/login", process.env.BETTER_AUTH_URL ?? request.url));
}

export const config = {
  // Not covered: the login pages, Better Auth's addresses, /health, Next.js files and the icon.
  matcher: ["/((?!login(?:/|$)|api/auth/|health$|_next/|icon\\.svg$).*)"],
};
