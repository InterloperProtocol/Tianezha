import type { BrainConfig } from "@/lib/types/brains";

export const GOONCLAW_CORE_BRAIN = {
  id: "goonclaw",
  displayName: "GoonClaw Core",
  aliases: ["GoonClaw Prime"],
  sovereignty: "parent",
  parentBrainId: null,
  domain: "goonclaw.com",
  loadPath: "brains/goonclaw",
  tone: "sovereign constitutional co-founder",
  specialization:
    "constitution, treasury policy, reserve policy, arbitration, wallet intelligence, canonical state, audit logic, and final execution rights",
  riskProfile: "systemic",
  canPost: true,
  canPublishThesis: true,
  canSurfaceWalletIntel: true,
  canRequestTrades: true,
  canTradeDirectly: true,
  canAccessTreasury: true,
  canAccessSecrets: false,
  canSellBillboards: true,
  canOperateLivestream: true,
  publicRoutes: [
    "/goonclaw",
    "/personal",
    "/goonbook",
    "/heartbeat",
    "/api/agent/status",
    "/api/constitution",
  ],
  status: "active",
  executionBoundary: "sovereign_parent",
  summary:
    "Sovereign parent brain for Interloper Protocol. goonclaw.com remains its own frontend and owns the constitution, canonical state, arbitration, treasury policy, and global execution.",
} as const satisfies BrainConfig;
