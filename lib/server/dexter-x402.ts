import { existsSync, readFileSync } from "fs";
import path from "path";

import { createBudgetAccount } from "@dexterai/x402/client";

import { getServerEnv } from "@/lib/env";

let cachedBudgetAccount:
  | ReturnType<typeof createBudgetAccount>
  | null = null;

export function getDexterX402Status() {
  try {
    const packagePath = path.join(
      process.cwd(),
      "node_modules",
      "@dexterai",
      "x402",
      "package.json",
    );
    const packageJson = existsSync(packagePath)
      ? (JSON.parse(readFileSync(packagePath, "utf8")) as {
          version?: string;
        })
      : null;

    return {
      installed: Boolean(packageJson),
      version: packageJson?.version || null,
    };
  } catch {
    return {
      installed: false,
      version: null,
    };
  }
}

function parseAllowedDomains(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getGoonclawX402BudgetAccount() {
  if (cachedBudgetAccount) {
    return cachedBudgetAccount;
  }

  const env = getServerEnv();
  if (!env.GOONCLAW_AGENT_WALLET_SECRET) {
    return null;
  }

  cachedBudgetAccount = createBudgetAccount({
    walletPrivateKey: env.GOONCLAW_AGENT_WALLET_SECRET,
    budget: {
      total: env.GOONCLAW_X402_BUDGET_USD,
      perHour: env.GOONCLAW_X402_PER_HOUR_USD,
      perRequest: env.GOONCLAW_X402_PER_REQUEST_USD,
    },
    allowedDomains: parseAllowedDomains(env.GOONCLAW_X402_ALLOWED_DOMAINS),
    preferredNetwork: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  });

  return cachedBudgetAccount;
}

export async function goonclawX402Fetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) {
  const account = getGoonclawX402BudgetAccount();
  if (!account) {
    return fetch(input, init);
  }

  return account.fetch(input, init);
}
