import { getTestDatabaseUrl } from "./test-database-url.mts";
import { prepareTestDatabase } from "./prepare-test-database.mts";

/** Creates the test database if it is missing and brings it up to date with ./drizzle. */
export default async function setup() {
  await prepareTestDatabase(getTestDatabaseUrl());
}
