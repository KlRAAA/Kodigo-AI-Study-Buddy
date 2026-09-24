import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Any Postgres-backed Drizzle instance with our schema. Neon HTTP in the app,
// PGlite in tests.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let instance: Db | undefined;

export function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    instance = drizzle({ client: neon(url), schema }) as unknown as Db;
  }
  return instance;
}

/** Test hook: swap in a different database (e.g. PGlite). */
export function setDbForTests(db: Db | undefined) {
  instance = db;
}
