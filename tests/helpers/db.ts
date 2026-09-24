import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import { setDbForTests, type Db } from "@/server/db/client";

/** Spins up an in-memory Postgres with our migrations applied. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  const typed = db as unknown as Db;
  setDbForTests(typed);
  return typed;
}
