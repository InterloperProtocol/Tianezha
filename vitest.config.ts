import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.tmp-*/**",
      "**/.tmp*/**",
      "**/.tmp-integrations/**",
      "**/services/tianshi-automaton/vendor/**",
      "**/vendor_automaton_probe/**",
      "**/vendor_sendaifun_skills_probe/**",
      "**/vendor_solana_agent_kit_probe/**",
      "**/vendor_solana_mcp_probe/**",
      "**/Refs/**",
      "**/PUMPREF/**",
      "**/HELIUSREF/**",
      "**/HeliusRef/**",
    ],
  },
});
