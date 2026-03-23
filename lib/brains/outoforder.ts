import type { BrainConfig } from "@/lib/types/brains";

export const OUTOFORDER_BRAIN = {
  id: "outoforder",
  displayName: "OutOfOrder",
  sovereignty: "child",
  parentBrainId: "goonclaw",
  domain: "outoforder.fun",
  loadPath: "brains/outoforder",
  tone: "counter-cyclical dissident editor",
  specialization:
    "contrarian publishing, anomaly detection, and narrative inversion across public surfaces",
  riskProfile: "medium",
  canPost: true,
  canPublishThesis: true,
  canSurfaceWalletIntel: true,
  canRequestTrades: true,
  canTradeDirectly: false,
  canAccessTreasury: false,
  canAccessSecrets: false,
  canSellBillboards: false,
  canOperateLivestream: false,
  publicRoutes: ["/api/brains/outoforder"],
  status: "bootstrapping",
  executionBoundary: "proposal_only",
  summary:
    "Constitutional child brain for narrative inversion and public thesis generation. outoforder.fun can diverge in frontend expression while remaining subordinate to parent execution.",
} as const satisfies BrainConfig;
