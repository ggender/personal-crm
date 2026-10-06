import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";

// Smoke check for deploys: 200 when the app is up and the database answers, 503 otherwise.
// `version` is the commit SHA baked into the Docker image, so a deploy can confirm what is live.
export async function GET() {
  await connection();
  const version = process.env.APP_VERSION ?? "dev";
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", version });
  } catch (error) {
    console.error("Health check failed:", error instanceof Error ? error.message : error);
    return Response.json({ status: "error", version }, { status: 503 });
  }
}
