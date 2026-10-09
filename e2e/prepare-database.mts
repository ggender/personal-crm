// Run by the Playwright web server command before the build: the server's health check needs the
// database, and Playwright starts the server before any global setup would run.
import { prepareTestDatabase } from "../tests/prepare-test-database.mts";
import { getE2eDatabaseUrl } from "../tests/test-database-url.mts";

await prepareTestDatabase(getE2eDatabaseUrl());
