// Applies pending SQL migrations from ./drizzle to the database in DATABASE_URL.
// Locally `pnpm db:migrate` loads DATABASE_URL and OWNER_EMAIL from .env; in production the Docker
// image runs this file with plain Node (`node scripts/migrate.ts`) and gets them from compose.
//
// OWNER_EMAIL is the owner of the data that exists before the login (drizzle/0004_data_owner.sql):
// it is handed to the migration through the database setting app.owner_email. It is read only
// when the migration needs it, so a database without data migrates without it.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm env:init` to create .env.");

  // One connection: the setting belongs to the session that runs the migrations.
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client`select set_config('app.owner_email', ${process.env.OWNER_EMAIL ?? ""}, false)`;
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
