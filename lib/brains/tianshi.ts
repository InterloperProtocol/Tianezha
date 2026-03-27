import type { BrainConfig } from "@/lib/types/brains";

export const TIANSHI_CORE_BRAIN = {
  id: "tianshi",
  displayName: "Tianshi Core",
  aliases: ["Tianshi Prime"],
  sovereignty: "parent",
  parentBrainId: null,
  domain: "tianshi.com",
  loadPath: "brains/tianshi",
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
    "/tianshi",
    "/personal",
    "/bitclaw",
    "/heartbeat",
    "/api/agent/status",
    "/api/constitution",
  ],
  status: "active",
  executionBoundary: "sovereign_parent",
  summary:
    "Sovereign parent brain for Interloper Protocol. tianshi.com remains its own frontend and owns the constitution, canonical state, arbitration, treasury policy, and global execution.",
} as const satisfies BrainConfig;
