// Test stand-in for "next/server". The real connection() throws outside a Next.js request;
// in tests there is nothing to wait for, so it returns at once. Only used via vitest.config.ts.
export async function connection() {}
