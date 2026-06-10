import { defineConfig } from "vitest/config";
import path from "path";

// Vitest runs ONLY the consumer-loop integration tests (src/__tests__/events).
// They need a real Postgres — PGlite (in-memory WASM) — which jest's sandbox
// cannot host. Jest keeps running the unit tests; `npm run test:loops` runs
// these. The alias below swaps `@/lib/db` for the PGlite-backed rig so the
// consumers/outbox/services execute unmodified.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/lib\/db$/, replacement: path.resolve(__dirname, "src/__tests__/events/test-db.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "src") + "/$1" },
    ],
  },
  test: {
    include: ["src/__tests__/events/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // One PGlite instance per file; keep files sequential.
    fileParallelism: false,
  },
});
