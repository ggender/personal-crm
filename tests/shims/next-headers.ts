// Test stand-in for "next/headers". There is no request in the tests, so there are no request
// headers, and cookies cannot be set (Better Auth treats this exact error as "no request scope").
// Only used via vitest.config.mts.
export async function headers() {
  return new Headers();
}

export async function cookies(): Promise<never> {
  throw new Error("`cookies` was called outside a request scope.");
}
