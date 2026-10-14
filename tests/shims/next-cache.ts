// Test stand-in for "next/cache". revalidatePath() throws outside a Next.js request; the tests
// call the server actions directly and only look at what they answer and what they changed in the
// database, so there is nothing to refresh. Only used via vitest.config.mts.
export function revalidatePath() {}
