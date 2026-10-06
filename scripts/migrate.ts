// Applies pending SQL migrations from ./drizzle to the database in DATABASE_URL.
// Locally `pnpm db:migrate` loads DATABASE_URL from .env; in production the Docker image
// runs this file with plain Node (`node scripts/migrate.ts`) and gets the variable from compose.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm env:init` to create .env.");

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
