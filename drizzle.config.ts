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
    // Supabase requires SSL — set POSTGRES_SSL=false only for local non-Supabase dev
    ssl: process.env.POSTGRES_SSL !== "false",
  },
} satisfies Config;
