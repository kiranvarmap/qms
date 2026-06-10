import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React-compiler advisory diagnostics: real cleanups, but they predate CI
    // and would block the pipeline. Kept visible as warnings; burn-down is
    // scheduled with the design-system page migration (blueprint Phase 3).
    // `react-hooks/rules-of-hooks` stays an error.
    rules: {
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static assets and generated files:
    "public/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
