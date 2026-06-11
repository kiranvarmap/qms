import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: [
    "**/__tests__/**/*.{ts,tsx}",
    "**/*.{test,spec}.{ts,tsx}",
  ],
  // Consumer-loop integration tests run under vitest (`npm run test:loops`):
  // they need PGlite, which jest's sandbox cannot host. See vitest.config.ts.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/src/__tests__/events/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/layout.tsx",
    "!src/app/**/layout.tsx",
  ],
};

export default createJestConfig(config);
