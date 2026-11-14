import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output and caches:
    "dist/**",
    ".vinext/**",
  ]),
  {
    // React Compiler rules introduced with eslint-plugin-react-hooks 6. The flagged
    // patterns (latest-value refs, state resets in effects) work today; rewriting
    // them is tracked for the TransitShell refactor, so they warn instead of fail.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);

export default eslintConfig;
