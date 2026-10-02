// Builds the Postgres connection string from environment variables.
// DATABASE_URL wins if set; otherwise the URL is assembled from the same
// POSTGRES_* variables that compose.yaml uses to start the local database.
export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } =
    process.env;
  const host = process.env.POSTGRES_HOST ?? "localhost";

  const missing = Object.entries({
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DB,
    POSTGRES_PORT,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Database settings are missing: set DATABASE_URL or ${missing.join(", ")} in .env`,
    );
  }

  const user = encodeURIComponent(POSTGRES_USER!);
  const password = encodeURIComponent(POSTGRES_PASSWORD!);
  return `postgres://${user}:${password}@${host}:${POSTGRES_PORT}/${POSTGRES_DB}`;
}

// Loads .env into process.env for standalone scripts (Next.js does this itself).
export function loadEnvFile(): void {
  try {
    process.loadEnvFile(".env");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
