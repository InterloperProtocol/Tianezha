export const CHILD_EXECUTION_RULE =
  "Children may think locally, but only the parent executes globally." as const;

export type BrainId =
  | "tianshi"
  | "bolclaw"
  | "trenchstroker"
  | "outoforder";

export type BrainSovereignty = "parent" | "child";
export type BrainStatus = "active" | "bootstrapping" | "paused";
export type BrainRiskProfile = "low" | "medium" | "high" | "systemic";
export type BrainExecutionBoundary = "sovereign_parent" | "proposal_only";
export type BrainTone = string;

export type ChildBrainAction =
  | "publish_post"
  | "publish_thesis"
  | "surface_wallet_intel"
  | "request_trade"
  | "request_billboard_action"
  | "request_wallet_watchlist"
  | "request_treasury_action"
  | "sell_billboard"
  | "operate_livestream";

export interface BrainPermissionSet {
  readonly canPost: boolean;
  readonly canPublishThesis: boolean;
  readonly canSurfaceWalletIntel: boolean;
  readonly canRequestTrades: boolean;
  readonly canTradeDirectly: boolean;
  readonly canAccessTreasury: boolean;
  readonly canAccessSecrets: false;
  readonly canSellBillboards: boolean;
  readonly canOperateLivestream: boolean;
}

export interface BrainConfig extends BrainPermissionSet {
  readonly id: BrainId;
  readonly displayName: string;
  readonly aliases?: ReadonlyArray<string>;
  readonly sovereignty: BrainSovereignty;
  readonly parentBrainId: BrainId | null;
  readonly domain: string;
  readonly loadPath: `brains/${BrainId}`;
  readonly tone: BrainTone;
  readonly specialization: string;
  readonly riskProfile: BrainRiskProfile;
  readonly publicRoutes: ReadonlyArray<string>;
  readonly status: BrainStatus;
  readonly executionBoundary: BrainExecutionBoundary;
  readonly summary: string;
}

export type ChildBrainConfig = BrainConfig & {
  readonly sovereignty: "child";
  readonly parentBrainId: "tianshi";
  readonly canTradeDirectly: false;
  readonly canAccessTreasury: false;
  readonly canAccessSecrets: false;
  readonly executionBoundary: "proposal_only";
};

export interface PublicBrainSummary extends BrainPermissionSet {
  readonly id: BrainId;
  readonly displayName: string;
  readonly aliases?: ReadonlyArray<string>;
  readonly sovereignty: BrainSovereignty;
  readonly parentBrainId: BrainId | null;
  readonly domain: string;
  readonly loadPath: `brains/${BrainId}`;
  readonly tone: BrainTone;
  readonly specialization: string;
  readonly riskProfile: BrainRiskProfile;
  readonly publicRoutes: ReadonlyArray<string>;
  readonly status: BrainStatus;
  readonly executionBoundary: BrainExecutionBoundary;
  readonly executionRule: typeof CHILD_EXECUTION_RULE;
  readonly summary: string;
}

export interface ChildBrainProposal {
  readonly childBrainId: Exclude<BrainId, "tianshi">;
  readonly parentBrainId: "tianshi";
  readonly action: ChildBrainAction;
  readonly rationale: string;
  readonly requestedAtMs: number;
  readonly requestedLamports?: string;
  readonly executionRule: typeof CHILD_EXECUTION_RULE;
  readonly status: "forwarded_to_parent";
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type BrainActionProposal = ChildBrainProposal;
