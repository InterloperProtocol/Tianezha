import path from "path";
import { fileURLToPath } from "url";

import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    ".tmp-*/**",
    ".tmp*/**",
    ".tmp-integrations/**",
    "next-env.d.ts",
    "services/goonclaw-automaton/vendor/**",
    "vendor_automaton_probe/**",
    "vendor_sendaifun_skills_probe/**",
    "vendor_solana_agent_kit_probe/**",
    "vendor_solana_mcp_probe/**",
    "Refs/**",
    "PUMPREF/**",
    "HELIUSREF/**",
    "HeliusRef/**",
  ]),
]);
