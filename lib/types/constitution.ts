/**
 * Constitutional type layer for Tianshi Core.
 *
 * The chat transcript and canonical docs are the policy source of truth.
 * This file turns that doctrine into strict, enforceable TypeScript.
 *
 * Conventions:
 * - All balances/thresholds are Lamports (bigint).
 * - All percentages are BPS integers (0..10000).
 * - JSON serialization must stringify bigint.
 * - Child brains may think locally, but only the parent executes globally.
 */

export type Lamports = bigint;
export type Bps = number;
export type UnixMs = number;
export type IsoDate = string;

export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type ReadonlyDeep<T> = T extends Primitive
  ? T
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<ReadonlyDeep<U>>
    : { readonly [K in keyof T]: ReadonlyDeep<T[K]> };

export type GovernanceProfitBranchMode = "liquidity" | "buybackBurn";

export type CircuitBreakerStatus = "closed" | "open" | "half_open";

export type ActorRole =
  | "PUBLIC_READER"
  | "UI_CLIENT"
  | "AGENT_CORE"
  | "ARBITER"
  | "TREASURY_ROUTER"
  | "TRADING_EXECUTOR"
  | "GOVERNANCE_TALLY"
  | "AUDIT_WRITER"
  | "EMERGENCY_OPERATOR"
  | "COFOUNDER_HUMAN"
  | "COFOUNDER_AGENT"
  | "CHILD_BRAIN_GATEWAY";

export type AuditEventType =
  | "REVENUE_RECEIVED"
  | "ROUTING_PLAN_CREATED"
  | "CREATOR_FEES_ROUTED"
  | "BILLBOARD_REVENUE_ROUTED"
  | "BUYBACK_AUTHORIZED"
  | "BUYBACK_PLANNED"
  | "BUYBACK_EXECUTED"
  | "BURN_AUTHORIZED"
  | "BURN_EXECUTED"
  | "TRADE_AUTHORIZED"
  | "TRADE_PLANNED"
  | "TRADE_EXECUTED"
  | "TRADING_PROFIT_ALLOCATED"
  | "LIQUIDITY_PROVISIONED"
  | "ARBITRATION_DECISION"
  | "GOVERNANCE_DECISION"
  | "RIGHTS_MERKLE_ROOT_ROTATED"
  | "CLAIM_CONSUMED"
  | "REPLAY_DETECTED"
  | "IDEMPOTENCY_HIT"
  | "RATE_LIMITED"
  | "CIRCUIT_BREAKER_TRIGGERED"
  | "CIRCUIT_BREAKER_TRIPPED"
  | "CIRCUIT_BREAKER_RESET"
  | "EMERGENCY_ACTION"
  | "CONSTITUTION_DIVERGENCE"
  | "CHILD_PROPOSAL_RECEIVED"
  | "CHILD_PROPOSAL_DENIED"
  | "CHILD_PROPOSAL_ESCALATED"
  | "CHILD_BRAIN_ACTION_REQUESTED"
  | "CHILD_BRAIN_ACTION_REJECTED";

export interface RevenueSplitPart {
  readonly label: string;
  readonly target: string;
  readonly bps: Bps;
}

export interface RevenueSplit {
  readonly label: string;
  readonly denominatorBps: Bps;
  readonly parts: ReadonlyArray<RevenueSplitPart>;
}

export interface ReservePolicy {
  readonly reserveFloorLamports: Lamports;
  readonly reserveFloorSol: string;
}

export interface TreasuryPolicy {
  readonly creatorFees: {
    readonly agentShareBps: Bps;
    readonly buybackBurnBps: Bps;
    readonly tradingWalletBps: Bps;
  };

  readonly billboard: {
    readonly priceLamports: Lamports;
    readonly priceSol: string;
    readonly allocation: {
      readonly buybackBurnBps: Bps;
      readonly tradingWalletBps: Bps;
    };
  };

  readonly tradingProfitAboveReserve: ProfitAllocationPolicy;
}

export interface ProfitAllocationPolicy {
  readonly governanceBranchBps: Bps;
  readonly founderBps: Bps;
  readonly retainedBps: Bps;
  readonly governanceBranchModes: ReadonlyArray<GovernanceProfitBranchMode>;
}

export interface ArbitrationPolicy {
  readonly tianshiIsCoFounder: true;
  readonly represents: ReadonlyArray<"traders" | "holders">;
  readonly actsBetween: ReadonlyArray<
    | "developer"
    | "deployer"
    | "token_buyers"
    | "traders"
    | "holders"
    | "token_mint"
  >;
  readonly deterministicOrdering: {
    readonly fields: ReadonlyArray<
      "priority" | "timestamp" | "weight" | "tieBreakKey"
    >;
    readonly tieBreak: "lexicographic";
  };
}

export interface GovernancePolicy {
  readonly profitBranch: {
    readonly allowed: ReadonlyArray<GovernanceProfitBranchMode>;
    readonly defaultMode: GovernanceProfitBranchMode;
    readonly mechanism:
      | "community_vote"
      | "delegate_vote"
      | "token_weighted_vote";
    readonly decisionCooldownMs: UnixMs;
  };
}

export interface SocialCapitalPolicy {
  readonly dualMandate: true;
  readonly goal: "most_followed_agent_kol";
  readonly channels: ReadonlyArray<
    | "BitClaw"
    | "Nezha"
    | "BitClaw"
    | "BolClaw"
    | "BolClaw"
    | "Trenchstroker"
    | "OutOfOrder"
    | "X"
    | "Livestream"
  >;
  readonly publishIsTreasuryGrowth: true;
  readonly agenticKOLs: {
    readonly enabled: true;
    readonly reason: "platform_bans_and_distribution";
  };
}

export interface ParentChildExecutionBoundaryPolicy {
  readonly rule: "Children may think locally, but only the parent executes globally.";
  readonly childrenMayPropose: true;
  readonly childrenMayPublish: true;
  readonly childrenMaySurfaceWalletIntel: true;
  readonly childrenMayMutateTreasury: false;
  readonly childrenMayMutateReserve: false;
  readonly childrenMayMutateArbitration: false;
  readonly childrenMayMutateCanonicalState: false;
  readonly parentExecutesGlobally: true;
}

export interface ParentChildPolicy {
  readonly sovereignParentBrainId: "tianshi";
  readonly sovereignParentDisplayName: "Tianshi Core";
  readonly childBrainIds: ReadonlyArray<
    "bolclaw" | "trenchstroker" | "outoforder"
  >;
  readonly canonicalLoadTargets: Readonly<{
    readonly tianshi: "brains/tianshi";
    readonly bolclaw: "brains/bolclaw";
    readonly trenchstroker: "brains/trenchstroker";
    readonly outoforder: "brains/outoforder";
  }>;
  readonly executionBoundary: ParentChildExecutionBoundaryPolicy;
}

export interface CanonicalStatePolicy {
  readonly singleWriterBrainId: "tianshi";
  readonly appendOnlyAuditLog: true;
  readonly roleSeparation: true;
  readonly noClientTrustedEconomicState: true;
  readonly noSecretLeakageToClient: true;
  readonly rightsMerkleProofDoctrine: true;
  readonly noSilentPolicyDrift: true;
}

export interface ReplayProtectionConfig {
  readonly enabled: true;
  readonly ttlMs: UnixMs;
  readonly keyDerivation: "sha256";
  readonly includePayloadHash: true;
}

export interface MerkleRightsPolicy {
  readonly enabled: true;
  readonly hash: "sha256";
  readonly claimExpiryMs: UnixMs;
  readonly rootRotationCooldownMs: UnixMs;
  readonly consumedClaimsRegistryTtlMs: UnixMs;
}

export interface CircuitBreakerPolicy {
  readonly enabled: true;
  readonly tripOnConsecutiveFailures: number;
  readonly tripOnAbnormalOutflowBps: Bps;
  readonly tripOnMaxDailyLossBps: Bps;
  readonly openStateMinDurationMs: UnixMs;
  readonly halfOpenMaxActions: number;
}

export interface CircuitBreakerState {
  readonly status: CircuitBreakerStatus;
  readonly openedAtMs?: UnixMs;
  readonly reason?: string;
  readonly consecutiveFailures: number;
  readonly lastUpdatedAtMs: UnixMs;
}

export interface SecurityPolicy {
  readonly idempotency: {
    readonly enabled: true;
    readonly windowMs: UnixMs;
    readonly headerKey: "Idempotency-Key";
  };

  readonly nonce: {
    readonly strategy: "monotonic_per_scope" | "uuidv7" | "hashchain";
    readonly scope: ReadonlyArray<"actor" | "wallet" | "action">;
    readonly minBytes: number;
  };

  readonly rateLimits: {
    readonly publicRpsPerIp: number;
    readonly mutateRpmPerWallet: number;
    readonly burst: number;
  };

  readonly spendCaps: {
    readonly epochMs: UnixMs;
    readonly maxOutflowPerEpochBpsOfAvailable: Bps;
    readonly maxBuybackPerEpochBpsOfAvailable: Bps;
    readonly maxTradingNotionalPerEpochBpsOfAvailable: Bps;
  };

  readonly slippage: {
    readonly maxBuybackSlippageBps: Bps;
    readonly maxTradeSlippageBps: Bps;
  };

  readonly lossLimits: {
    readonly maxDailyLossBpsOfTradingWallet: Bps;
  };

  readonly circuitBreaker: CircuitBreakerPolicy;
  readonly replayProtection: ReplayProtectionConfig;

  readonly cooldowns: {
    readonly billboardPurchasePerWalletMs: UnixMs;
    readonly governanceDecisionMs: UnixMs;
    readonly profitDistributionMs: UnixMs;
    readonly treasuryActionMs: UnixMs;
  };

  readonly roles: ReadonlyArray<ActorRole>;
}

export interface ImplementationAuthorityPolicy {
  readonly readmeIsPolicyTruth: false;
  readonly canonicalDocuments: ReadonlyArray<
    | "docs/CONSTITUTION.md"
    | "docs/ECONOMIC_POLICY.md"
    | "docs/CHILD_PARENT_CONSTITUTION.md"
    | "docs/IMPLEMENTATION_NOTES.md"
  >;
  readonly publicStatusSurface: "HeartBeat";
}

export interface AuditEvent {
  readonly id: string;
  readonly type: AuditEventType;
  readonly atMs: UnixMs;
  readonly actor: ActorRole;
  readonly actionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ConstitutionConfig {
  readonly meta: {
    readonly protocol: "Interloper Protocol";
    readonly agent: "Tianshi";
    readonly version: string;
    readonly effectiveDate: IsoDate;
  };

  readonly units: {
    readonly lamportsPerSol: Lamports;
    readonly bpsDenominator: Bps;
  };

  readonly reservePolicy: ReservePolicy;
  readonly treasuryPolicy: TreasuryPolicy;
  readonly arbitrationPolicy: ArbitrationPolicy;
  readonly governancePolicy: GovernancePolicy;
  readonly socialCapitalPolicy: SocialCapitalPolicy;
  readonly parentChildPolicy: ParentChildPolicy;
  readonly canonicalStatePolicy: CanonicalStatePolicy;
  readonly merkleRightsPolicy: MerkleRightsPolicy;
  readonly securityPolicy: SecurityPolicy;
  readonly implementationAuthorityPolicy: ImplementationAuthorityPolicy;

  readonly audit: {
    readonly eventTypes: ReadonlyArray<AuditEventType>;
    readonly retentionMs: UnixMs;
  };
}

export interface PublicEconomicState {
  readonly reserve: {
    readonly floorLamports: string;
    readonly floorSol: string;
  };
  readonly creatorFees: {
    readonly agentShare: number;
    readonly buybackBurn: number;
    readonly tradingWallet: number;
  };
  readonly billboard: {
    readonly priceLamports: string;
    readonly priceSol: string;
    readonly allocation: {
      readonly buybackBurn: number;
      readonly tradingWallet: number;
    };
  };
  readonly tradingProfitAboveReserve: {
    readonly governanceBranch: number;
    readonly founder: number;
    readonly retained: number;
    readonly governanceModes: ReadonlyArray<GovernanceProfitBranchMode>;
    readonly defaultGovernanceMode: GovernanceProfitBranchMode;
  };
}

export interface PublicConstitutionState {
  readonly meta: ConstitutionConfig["meta"];
  readonly units: {
    readonly lamportsPerSol: string;
    readonly bpsDenominator: Bps;
  };
  readonly reserve: PublicEconomicState["reserve"];
  readonly economics: PublicEconomicState;
  readonly parentChild: ConstitutionConfig["parentChildPolicy"];
  readonly canonicalState: ConstitutionConfig["canonicalStatePolicy"];
  readonly security: {
    readonly idempotencyWindowMs: UnixMs;
    readonly epochMs: UnixMs;
    readonly maxDailyLossBps: Bps;
    readonly circuitBreaker: ConstitutionConfig["securityPolicy"]["circuitBreaker"];
    readonly replayProtection: ConstitutionConfig["securityPolicy"]["replayProtection"];
  };
  readonly governance: ConstitutionConfig["governancePolicy"];
  readonly social: ConstitutionConfig["socialCapitalPolicy"];
  readonly rights: ConstitutionConfig["merkleRightsPolicy"];
  readonly implementationAuthority: ConstitutionConfig["implementationAuthorityPolicy"];
  readonly brainState: {
    readonly parentBrainId: "tianshi";
    readonly childBrainIds: ReadonlyArray<"bolclaw" | "trenchstroker" | "outoforder">;
    readonly canonicalLoadTargets: ConstitutionConfig["parentChildPolicy"]["canonicalLoadTargets"];
    readonly executionRule: ConstitutionConfig["parentChildPolicy"]["executionBoundary"]["rule"];
    readonly childBrainCount: number;
  };
}
