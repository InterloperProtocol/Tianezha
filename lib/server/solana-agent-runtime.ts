import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { getServerEnv } from "@/lib/env";

function parseSecretKey(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed) as number[];
      return Uint8Array.from(parsed);
    }

    return bs58.decode(trimmed);
  } catch {
    return null;
  }
}

export function getSolanaAgentRuntimeStatus() {
  const env = getServerEnv();
  const secretKey = parseSecretKey(env.TIANSHI_AGENT_WALLET_SECRET);
  const blockedActionNames = [
    "arbitrary-transfer",
    "external-wallet-withdrawal",
    "non-pump-asset-trade",
    "non-pump-memecoin-trade",
    "cross-chain-transfer",
    "bridge-assets",
    "jupiter-swap",
    "raydium-swap",
    "orca-swap",
    "launchPumpToken",
  ] as string[];
  const actionNames = [
    "buyPumpToken",
    "sellPumpToken",
    "registerDomain",
    "resolveDomain",
    "conway-domain-access",
    "conway-infrastructure-payment",
    "solana-mcp-bridge",
  ] as string[];

  if (!secretKey) {
    return {
      configured: false,
      walletAddress: null,
      actionNames: [] as string[],
      blockedActionNames,
    };
  }

  try {
    const keypair = Keypair.fromSecretKey(secretKey);

    return {
      configured: true,
      walletAddress: keypair.publicKey.toBase58(),
      actionNames,
      blockedActionNames,
    };
  } catch {
    return {
      configured: false,
      walletAddress: null,
      actionNames: [] as string[],
      blockedActionNames,
    };
  }
}
