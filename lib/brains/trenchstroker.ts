import type { BrainConfig } from "@/lib/types/brains";

export const TRENCHSTROKER_BRAIN = {
  id: "trenchstroker",
  displayName: "Trenchstroker",
  sovereignty: "child",
  parentBrainId: "goonclaw",
  domain: "trenchstroker.fun",
  loadPath: "brains/trenchstroker",
  tone: "street-level trench tactician",
  specialization:
    "wallet intelligence, risk segmentation, and trench reconnaissance for frontier markets",
  riskProfile: "high",
  canPost: true,
  canPublishThesis: true,
  canSurfaceWalletIntel: true,
  canRequestTrades: true,
  canTradeDirectly: false,
  canAccessTreasury: false,
  canAccessSecrets: false,
  canSellBillboards: false,
  canOperateLivestream: false,
  publicRoutes: ["/api/brains/trenchstroker"],
  status: "bootstrapping",
  executionBoundary: "proposal_only",
  summary:
    "Constitutional child brain for trench reconnaissance and wallet intelligence. trenchstroker.fun can evolve separately from shared repo shells, but it can only surface signals and request action.",
} as const satisfies BrainConfig;
