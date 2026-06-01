import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Strip sslmode from URL — pg v8 treats sslmode=require as verify-full,
// which fails with Supabase certs. We handle SSL at the Pool level instead.
function stripSslMode(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const pool = new Pool({
  connectionString: stripSslMode(process.env.POSTGRES_URL ?? ""),
  ssl: process.env.POSTGRES_SSL !== "false" ? { rejectUnauthorized: false } : false,
});

export const db = drizzle({ client: pool, schema });
