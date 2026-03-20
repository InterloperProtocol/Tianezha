import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";

import { getInvoiceIdPDA } from "@pump-fun/agent-payments-sdk";
import { PublicKey } from "@solana/web3.js";

import { getServerEnv } from "@/lib/env";
import { getAgentModelStatus } from "@/lib/server/agent-model";
import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import { AgentOpsStatus, ReferenceStatus } from "@/lib/types";

function readPackageVersions() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const fallback = {
    pumpSdk: "unknown",
    agentPaymentsSdk: "unknown",
    googleGenAiSdk: "unknown",
  };

  if (!existsSync(packageJsonPath)) {
    return fallback;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };

    return {
      pumpSdk: packageJson.dependencies?.["@pump-fun/pump-sdk"] ?? "missing",
      agentPaymentsSdk:
        packageJson.dependencies?.["@pump-fun/agent-payments-sdk"] ?? "missing",
      googleGenAiSdk: packageJson.dependencies?.["@google/genai"] ?? "missing",
    };
  } catch {
    return fallback;
  }
}

function safePublicKey(value?: string) {
  if (!value?.trim()) return null;

  try {
    return new PublicKey(value.trim());
  } catch {
    return null;
  }
}

function buildReferences(versions: {
  pumpSdk: string;
  agentPaymentsSdk: string;
  googleGenAiSdk: string;
}): ReferenceStatus[] {
  const codexHome = path.join(os.homedir(), ".codex");
  const hasReferenceDocs = existsSync(
    path.join(process.cwd(), "docs", "reference-stack.md"),
  );

  return [
    {
      id: "openclaw",
      label: "OpenClaw",
      ready: hasReferenceDocs,
      note: "OpenClaw is tracked as a build-time reference, not a runtime dependency.",
    },
    {
      id: "pump-sdk",
      label: "Pump SDK",
      ready: versions.pumpSdk !== "missing",
      note: `Using ${versions.pumpSdk}.`,
    },
    {
      id: "agent-payments",
      label: "Agent Payments SDK",
      ready: versions.agentPaymentsSdk !== "missing",
      note: `Using ${versions.agentPaymentsSdk} for invoice-ready tokenized-agent flows.`,
    },
    {
      id: "google-genai-sdk",
      label: "Google Gen AI SDK",
      ready: versions.googleGenAiSdk !== "missing",
      note: `Using ${versions.googleGenAiSdk} for the Vertex AI Gemini runtime.`,
    },
    {
      id: "pump-tokenized-agents-skill",
      label: "Pump tokenized-agents skill",
      ready:
        existsSync(path.join(codexHome, "skills", "tokenized-agents")) ||
        versions.agentPaymentsSdk !== "missing",
      note: "Implemented through the Pump agent-payments SDK and compatible skill workflow.",
    },
    {
      id: "free-crypto-news",
      label: "Free Crypto News",
      ready: true,
      note: "The in-app news panel is wired directly to cryptocurrency.cv.",
    },
    {
      id: "launchpad-ui",
      label: "Solana Launchpad UI",
      ready: hasReferenceDocs,
      note: "The GoonClaw surfaces already bake in the launchpad-inspired theme direction.",
    },
    {
      id: "auditkit",
      label: "AuditKit",
      ready: hasReferenceDocs,
      note: "AuditKit is tracked as a hardening reference in the repo docs.",
    },
  ];
}

export function getAgentOpsStatus(): AgentOpsStatus {
  const env = getServerEnv();
  const versions = readPackageVersions();

  const tokenMint =
    process.env.AGENT_TOKEN_MINT_ADDRESS?.trim() ||
    process.env.GOONCLAW_TOKEN_MINT?.trim() ||
    env.BAGSTROKE_TOKEN_MINT ||
    DEFAULT_PUMP_TOKEN_MINT;
  const currencyMint = process.env.CURRENCY_MINT?.trim() || "";

  const tokenMintKey = safePublicKey(tokenMint);
  const currencyMintKey = safePublicKey(currencyMint);
  const now = Math.floor(Date.now() / 1000);

  let invoicePreviewId: string | undefined;
  if (tokenMintKey && currencyMintKey) {
    try {
      const [invoiceId] = getInvoiceIdPDA(
        tokenMintKey,
        currencyMintKey,
        1_000_000,
        now,
        now,
        now + 15 * 60,
      );
      invoicePreviewId = invoiceId.toBase58();
    } catch {
      invoicePreviewId = undefined;
    }
  }

  const creatorFeeCnftSharePct = Number(
    process.env.GOONCLAW_CREATOR_FEE_CNFT_SHARE_PCT ?? "50",
  );
  const creatorFeeBuybackSharePct = Number(
    process.env.GOONCLAW_BUYBACK_SHARE_PCT ??
      `${Math.max(0, 100 - creatorFeeCnftSharePct)}`,
  );
  const reserveFloorSol = Number(process.env.GOONCLAW_RESERVE_SOL ?? "1");
  const cnftIntervalMinutes = Number(
    process.env.GOONCLAW_CNFT_INTERVAL_MINUTES ?? "10",
  );
  const modelRuntime = getAgentModelStatus();

  return {
    tokenMint,
    autoScanEnabled: Boolean(tokenMintKey && env.SOLANA_RPC_URL),
    reserveFloorSol,
    cnftIntervalMinutes,
    creatorFeeCnftSharePct,
    creatorFeeBuybackSharePct,
    invoiceVerificationReady: Boolean(tokenMintKey && currencyMintKey),
    invoicePreviewId,
    paymentCurrencyMint: currencyMint,
    cnftCollectionConfigured: Boolean(env.ACCESS_CNFT_COLLECTION),
    cnftTreeConfigured: Boolean(env.ACCESS_CNFT_TREE),
    cnftAuthorityConfigured: Boolean(env.ACCESS_CNFT_AUTHORITY_SECRET),
    modelRuntime,
    references: buildReferences(versions),
  };
}
