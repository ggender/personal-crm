import { getAuth } from "@/lib/auth";

// Better Auth's own addresses: the login link from the email opens /api/auth/magic-link/verify,
// the browser renews the login through /api/auth/get-session.
export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
