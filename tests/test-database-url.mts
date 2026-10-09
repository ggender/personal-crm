// @next/env is a CommonJS package: its functions are reached through the default import.
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

/** The suffix every database the tests may touch must have. */
export const TEST_DATABASE_SUFFIX = "_test";

/** Throws unless the connection string points to a database whose name ends with "_test". */
export function assertTestDatabaseUrl(url: string) {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to use database "${name}": tests only run on a database whose name ends with "${TEST_DATABASE_SUFFIX}".`,
    );
  }
}

/** Replaces the database name in a connection string. */
export function withDatabaseName(url: string, name: string) {
  const parsed = new URL(url);
  parsed.pathname = `/${encodeURIComponent(name)}`;
  return parsed.toString();
}

/**
 * Connection string of the test database: TEST_DATABASE_URL (e.g. in CI), otherwise the
 * DATABASE_URL from .env with the database name changed to "<name>_test".
 */
export function getTestDatabaseUrl() {
  loadEnvConfig(process.cwd());
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) {
    assertTestDatabaseUrl(explicit);
    return explicit;
  }
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL is not set. Run `pnpm env:init` to create .env.");
  }
  const name = decodeURIComponent(new URL(base).pathname.slice(1));
  const url = withDatabaseName(base, name.endsWith(TEST_DATABASE_SUFFIX) ? name : `${name}_test`);
  assertTestDatabaseUrl(url);
  return url;
}
