/**
 * Consumer-loop test rig: a real Postgres (PGlite, in-memory WASM) with the
 * full migration history applied, swapped in for `@/lib/db` via jest.mock.
 * Consumers, the outbox, and services run unmodified against it — so these
 * tests exercise the exact SQL the production loops execute.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "path";
import * as schema from "@/lib/db/schema";

const client = new PGlite();

export const db = drizzle(client, { schema });

let migrated: Promise<void> | null = null;

/** Apply all drizzle migrations once per test process. */
export function ready(): Promise<void> {
  if (!migrated) {
    migrated = migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  }
  return migrated;
}
