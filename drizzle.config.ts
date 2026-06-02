import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Load .env.local first, then .env
config({ path: ".env.local" });
config({ path: ".env" });

export default {
  schema:      "./src/lib/db/schema.ts",
  out:         "./drizzle",
  dialect:     "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
    // SSL on by default (Supabase/Azure require it). rejectUnauthorized:false to
    // match the app runtime (db/index.ts) — managed Postgres presents cert chains
    // not in the local CA bundle. Set POSTGRES_SSL=false for local non-SSL dev.
    ssl: process.env.POSTGRES_SSL === "false" ? false : { rejectUnauthorized: false },
  },
} satisfies Config;
