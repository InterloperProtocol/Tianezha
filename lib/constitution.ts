import type {
  ActorRole,
  AuditEventType,
  Bps,
  ConstitutionConfig,
  Lamports,
  PublicConstitutionState,
  PublicEconomicState,
  ReadonlyDeep,
  RevenueSplit,
} from "./types/constitution";
import type { BrainId } from "./types/brains";

export const LAMPORTS_PER_SOL: Lamports = 1_000_000_000n;
export const BPS_DENOMINATOR: Bps = 10_000;

export const BRAIN_REGISTRY_METADATA = deepFreeze({
  parentBrain: {
    id: "goonclaw",
    displayName: "GoonClaw Core",
    aliases: ["GoonClaw Prime"],
    domain: "goonclaw.com",
    loadPath: "brains/goonclaw",
    publicRoutes: [
      "/goonclaw",
      "/personal",
      "/goonbook",
      "/heartbeat",
      "/api/agent/status",
      "/api/constitution",
    ],
    summary:
      "Sovereign parent brain and frontend authority for constitutional state, treasury policy, arbitration, wallet intelligence, and final execution.",
  },
  childBrains: [
    {
      id: "bolclaw",
      displayName: "BolClaw",
      domain: "bolclaw.fun",
      loadPath: "brains/bolclaw",
      publicRoutes: ["/bolclaw", "/goonstreams", "/api/brains/bolclaw"],
      summary:
        "Constitutional child brain for livestream, billboard, and attention-routing surfaces. bolclaw.fun is distinct from repo-hosted pages that may temporarily share interface shells.",
    },
    {
      id: "trenchstroker",
      displayName: "Trenchstroker",
      domain: "trenchstroker.fun",
      loadPath: "brains/trenchstroker",
      publicRoutes: ["/api/brains/trenchstroker"],
      summary:
        "Constitutional child brain for trench reconnaissance, wallet intelligence, and risk segmentation. Its external frontend may diverge from repo-hosted shared shells over time.",
    },
    {
      id: "outoforder",
      displayName: "OutOfOrder",
      domain: "outoforder.fun",
      loadPath: "brains/outoforder",
      publicRoutes: ["/api/brains/outoforder"],
      summary:
        "Constitutional child brain for contrarian publishing and anomaly narration, with a frontend that can evolve separately from shared repo surfaces.",
    },
  ] as const,
  rule: "Children may think locally, but only the parent executes globally." as const,
  sharedInterfacePolicy:
    "Repo-hosted pages may temporarily share interface shells while external domains remain distinct constitutional brain frontends.",
});

export function lamportsToJson(lamports: Lamports): string {
  return lamports.toString(10);
}

export function solToLamports(sol: string | number): Lamports {
  const raw = typeof sol === "number" ? sol.toString() : sol;
  const normalized = raw.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid SOL amount: "${raw}"`);
  }

  const [wholeStr, fractionStr = ""] = normalized.split(".");
  const whole = BigInt(wholeStr);
  const fraction = BigInt((fractionStr + "0".repeat(9)).slice(0, 9));

  return whole * LAMPORTS_PER_SOL + fraction;
}

export function lamportsToSolString(lamports: Lamports): string {
  const sign = lamports < 0n ? "-" : "";
  const absolute = lamports < 0n ? -lamports : lamports;
  const whole = absolute / LAMPORTS_PER_SOL;
  const fraction = absolute % LAMPORTS_PER_SOL;
  const fractionFixed = fraction.toString(10).padStart(9, "0");
  const fractionTrimmed = fractionFixed.replace(/0+$/, "");

  return fractionTrimmed.length
    ? `${sign}${whole.toString(10)}.${fractionTrimmed}`
    : `${sign}${whole.toString(10)}`;
}

export function bpsToShare(bps: Bps): number {
  return bps / BPS_DENOMINATOR;
}

export function mulLamportsBps(amount: Lamports, bps: Bps): Lamports {
  return (amount * BigInt(bps)) / BigInt(BPS_DENOMINATOR);
}

export function minLamports(a: Lamports, b: Lamports): Lamports {
  return a <= b ? a : b;
}

export function maxLamports(a: Lamports, b: Lamports): Lamports {
  return a >= b ? a : b;
}

export function deepFreeze<T>(obj: T): ReadonlyDeep<T> {
  if (obj === null || typeof obj !== "object") {
    return obj as ReadonlyDeep<T>;
  }

  const target = obj as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(target)) {
    const value = target[key];
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj) as ReadonlyDeep<T>;
}

export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertBps(bps: Bps, label: string): void {
  invariant(Number.isInteger(bps), `${label} must be an integer bps`);
  invariant(
    bps >= 0 && bps <= BPS_DENOMINATOR,
    `${label} must be within 0..${BPS_DENOMINATOR}`,
  );
}

export function assertValidRevenueSplit(split: RevenueSplit): void {
  assertBps(split.denominatorBps, `${split.label}.denominatorBps`);
  const sum = split.parts.reduce((total, part) => total + part.bps, 0);

  invariant(
    sum === split.denominatorBps,
    `${split.label} split invalid: sum=${sum}, expected=${split.denominatorBps}`,
  );

  for (const part of split.parts) {
    assertBps(part.bps, `${split.label}.${part.label}.bps`);
  }
}

export function assertReserveFloor(
  currentTreasuryLamports: Lamports,
  reserveFloorLamports: Lamports,
): void {
  invariant(
    currentTreasuryLamports >= reserveFloorLamports,
    `Reserve floor breach: treasury=${lamportsToSolString(currentTreasuryLamports)} SOL < floor=${lamportsToSolString(reserveFloorLamports)} SOL`,
  );
}

export function assertReserveFloorAfterOutflow(args: {
  readonly currentTreasuryLamports: Lamports;
  readonly requestedOutflowLamports: Lamports;
  readonly reserveFloorLamports: Lamports;
}): void {
  invariant(
    args.currentTreasuryLamports - args.requestedOutflowLamports >=
      args.reserveFloorLamports,
    "Requested outflow would breach the constitutional reserve floor.",
  );
}

export function availableAboveReserve(
  currentTreasuryLamports: Lamports,
  reserveFloorLamports: Lamports,
): Lamports {
  return currentTreasuryLamports > reserveFloorLamports
    ? currentTreasuryLamports - reserveFloorLamports
    : 0n;
}

export interface CreatorFeeRoutingPlan {
  readonly totalCreatorFeesLamports: Lamports;
  readonly toAgentLamports: Lamports;
  readonly buybackBurnLamports: Lamports;
  readonly tradingWalletLamports: Lamports;
  readonly remainderNonAgentLamports: Lamports;
}

export function routeCreatorFees(
  totalCreatorFeesLamports: Lamports,
  cfg = CONSTITUTION,
): CreatorFeeRoutingPlan {
  const { creatorFees } = cfg.treasuryPolicy;
  const buybackBurnLamports = mulLamportsBps(
    totalCreatorFeesLamports,
    creatorFees.buybackBurnBps,
  );
  const tradingWalletLamports = mulLamportsBps(
    totalCreatorFeesLamports,
    creatorFees.tradingWalletBps,
  );
  const toAgentLamports = buybackBurnLamports + tradingWalletLamports;
  const agentShareLamports = mulLamportsBps(
    totalCreatorFeesLamports,
    creatorFees.agentShareBps,
  );

  invariant(
    toAgentLamports <= agentShareLamports,
    "Creator fee routing overflow due to rounding.",
  );

  return {
    totalCreatorFeesLamports,
    toAgentLamports,
    buybackBurnLamports,
    tradingWalletLamports,
    remainderNonAgentLamports: totalCreatorFeesLamports - toAgentLamports,
  };
}

export interface BillboardRevenueRoutingPlan {
  readonly totalBillboardRevenueLamports: Lamports;
  readonly buybackBurnLamports: Lamports;
  readonly tradingWalletLamports: Lamports;
}

export function routeBillboardRevenue(
  totalBillboardRevenueLamports: Lamports,
  cfg = CONSTITUTION,
): BillboardRevenueRoutingPlan {
  const { allocation } = cfg.treasuryPolicy.billboard;
  const buybackBurnLamports = mulLamportsBps(
    totalBillboardRevenueLamports,
    allocation.buybackBurnBps,
  );

  return {
    totalBillboardRevenueLamports,
    buybackBurnLamports,
    tradingWalletLamports: totalBillboardRevenueLamports - buybackBurnLamports,
  };
}

export interface TradingProfitAllocationPlan {
  readonly realizedProfitLamports: Lamports;
  readonly distributableLamports: Lamports;
  readonly governanceBranchLamports: Lamports;
  readonly founderLamports: Lamports;
  readonly retainedLamports: Lamports;
  readonly governanceMode: "liquidity" | "buybackBurn";
}

export function allocateTradingProfitAboveReserve(args: {
  readonly realizedProfitLamports: Lamports;
  readonly currentTreasuryLamports: Lamports;
  readonly governanceMode?: "liquidity" | "buybackBurn";
  readonly cfg?: ReadonlyDeep<ConstitutionConfig>;
}): TradingProfitAllocationPlan {
  const cfg = (args.cfg ?? CONSTITUTION) as ReadonlyDeep<ConstitutionConfig>;
  const governanceMode =
    args.governanceMode ?? cfg.governancePolicy.profitBranch.defaultMode;
  const reserveFloorLamports = cfg.reservePolicy.reserveFloorLamports;
  const distributableLamports = minLamports(
    args.realizedProfitLamports,
    availableAboveReserve(args.currentTreasuryLamports, reserveFloorLamports),
  );
  const policy = cfg.treasuryPolicy.tradingProfitAboveReserve;
  const governanceBranchLamports = mulLamportsBps(
    distributableLamports,
    policy.governanceBranchBps,
  );
  const founderLamports = mulLamportsBps(
    distributableLamports,
    policy.founderBps,
  );

  return {
    realizedProfitLamports: args.realizedProfitLamports,
    distributableLamports,
    governanceBranchLamports,
    founderLamports,
    retainedLamports:
      distributableLamports - governanceBranchLamports - founderLamports,
    governanceMode,
  };
}

export function getTreasuryPosture(args: {
  readonly currentTreasuryLamports: Lamports;
  readonly cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = (args.cfg ?? CONSTITUTION) as ReadonlyDeep<ConstitutionConfig>;
  const reserveFloorLamports = cfg.reservePolicy.reserveFloorLamports;
  const availableLamports = availableAboveReserve(
    args.currentTreasuryLamports,
    reserveFloorLamports,
  );
  const maxBuybackLamports = mulLamportsBps(
    availableLamports,
    cfg.securityPolicy.spendCaps.maxBuybackPerEpochBpsOfAvailable,
  );
  const maxTradingLamports = mulLamportsBps(
    availableLamports,
    cfg.securityPolicy.spendCaps.maxTradingNotionalPerEpochBpsOfAvailable,
  );

  return {
    currentTreasuryLamports: lamportsToJson(args.currentTreasuryLamports),
    currentTreasurySol: lamportsToSolString(args.currentTreasuryLamports),
    reserveFloorLamports: lamportsToJson(reserveFloorLamports),
    reserveFloorSol: cfg.reservePolicy.reserveFloorSol,
    availableAboveReserveLamports: lamportsToJson(availableLamports),
    availableAboveReserveSol: lamportsToSolString(availableLamports),
    reserveHealthy: args.currentTreasuryLamports >= reserveFloorLamports,
    maxBuybackSpendThisEpochLamports: lamportsToJson(maxBuybackLamports),
    maxBuybackSpendThisEpochSol: lamportsToSolString(maxBuybackLamports),
    maxTradingNotionalThisEpochLamports: lamportsToJson(maxTradingLamports),
    maxTradingNotionalThisEpochSol: lamportsToSolString(maxTradingLamports),
    governanceMode: cfg.governancePolicy.profitBranch.defaultMode,
  };
}

export function getBrainById(brainId: string) {
  if (brainId === BRAIN_REGISTRY_METADATA.parentBrain.id) {
    return BRAIN_REGISTRY_METADATA.parentBrain;
  }

  return BRAIN_REGISTRY_METADATA.childBrains.find((brain) => brain.id === brainId);
}

export function assertChildBrainCannotExecute(args: {
  readonly actingBrainId: string;
  readonly attemptedAction?: string;
  readonly cfg?: ReadonlyDeep<ConstitutionConfig>;
}): void {
  const cfg = args.cfg ?? CONSTITUTION;
  if (
    cfg.parentChildPolicy.childBrainIds.includes(args.actingBrainId as Exclude<BrainId, "goonclaw">)
  ) {
    const attemptedAction = args.attemptedAction ?? "execute globally";
    throw new Error(
      `Child brain ${args.actingBrainId} cannot ${attemptedAction}. ${cfg.parentChildPolicy.executionBoundary.rule}`,
    );
  }
}

export function getPublicEconomicState(
  cfg: ReadonlyDeep<ConstitutionConfig> = CONSTITUTION,
): PublicEconomicState {
  const creatorFees = cfg.treasuryPolicy.creatorFees;
  const billboard = cfg.treasuryPolicy.billboard;
  const profits = cfg.treasuryPolicy.tradingProfitAboveReserve;

  return {
    reserve: {
      floorLamports: lamportsToJson(cfg.reservePolicy.reserveFloorLamports),
      floorSol: cfg.reservePolicy.reserveFloorSol,
    },
    creatorFees: {
      agentShare: bpsToShare(creatorFees.agentShareBps),
      buybackBurn: bpsToShare(creatorFees.buybackBurnBps),
      tradingWallet: bpsToShare(creatorFees.tradingWalletBps),
    },
    billboard: {
      priceLamports: lamportsToJson(billboard.priceLamports),
      priceSol: billboard.priceSol,
      allocation: {
        buybackBurn: bpsToShare(billboard.allocation.buybackBurnBps),
        tradingWallet: bpsToShare(billboard.allocation.tradingWalletBps),
      },
    },
    tradingProfitAboveReserve: {
      governanceBranch: bpsToShare(profits.governanceBranchBps),
      founder: bpsToShare(profits.founderBps),
      retained: bpsToShare(profits.retainedBps),
      governanceModes: profits.governanceBranchModes,
      defaultGovernanceMode: cfg.governancePolicy.profitBranch.defaultMode,
    },
  };
}

export function getPublicBrainState(
  cfg: ReadonlyDeep<ConstitutionConfig> = CONSTITUTION,
) {
  return {
    parentBrain: BRAIN_REGISTRY_METADATA.parentBrain,
    childBrains: BRAIN_REGISTRY_METADATA.childBrains,
    parentBrainId: cfg.parentChildPolicy.sovereignParentBrainId,
    childBrainIds: cfg.parentChildPolicy.childBrainIds,
    canonicalLoadTargets: cfg.parentChildPolicy.canonicalLoadTargets,
    executionRule: cfg.parentChildPolicy.executionBoundary.rule,
    childBrainCount: cfg.parentChildPolicy.childBrainIds.length,
    sharedInterfacePolicy: BRAIN_REGISTRY_METADATA.sharedInterfacePolicy,
  };
}

export function assertConstitutionInvariant(
  cfg: ReadonlyDeep<ConstitutionConfig> = CONSTITUTION,
): void {
  invariant(cfg.units.lamportsPerSol === LAMPORTS_PER_SOL, "lamportsPerSol mismatch");
  assertBps(cfg.units.bpsDenominator, "bpsDenominator");
  invariant(
    cfg.units.bpsDenominator === BPS_DENOMINATOR,
    "bpsDenominator must be 10000",
  );
  invariant(cfg.reservePolicy.reserveFloorLamports > 0n, "reserve floor must be > 0");

  const creatorFees = cfg.treasuryPolicy.creatorFees;
  assertBps(creatorFees.agentShareBps, "creatorFees.agentShareBps");
  assertBps(creatorFees.buybackBurnBps, "creatorFees.buybackBurnBps");
  assertBps(creatorFees.tradingWalletBps, "creatorFees.tradingWalletBps");
  invariant(
    creatorFees.buybackBurnBps + creatorFees.tradingWalletBps ===
      creatorFees.agentShareBps,
    "creator fee splits must sum to agentShare",
  );

  const billboard = cfg.treasuryPolicy.billboard.allocation;
  assertBps(billboard.buybackBurnBps, "billboard.buybackBurnBps");
  assertBps(billboard.tradingWalletBps, "billboard.tradingWalletBps");
  invariant(
    billboard.buybackBurnBps + billboard.tradingWalletBps === BPS_DENOMINATOR,
    "billboard allocation must sum to 100%",
  );

  const profits = cfg.treasuryPolicy.tradingProfitAboveReserve;
  assertBps(profits.governanceBranchBps, "profit.governanceBranchBps");
  assertBps(profits.founderBps, "profit.founderBps");
  assertBps(profits.retainedBps, "profit.retainedBps");
  invariant(
    profits.governanceBranchBps +
      profits.founderBps +
      profits.retainedBps ===
      BPS_DENOMINATOR,
    "profit allocation must sum to 100%",
  );

  const hierarchy = cfg.parentChildPolicy;
  invariant(
    hierarchy.sovereignParentBrainId === cfg.canonicalStatePolicy.singleWriterBrainId,
    "single writer brain must match sovereign parent brain",
  );
  invariant(
    hierarchy.childBrainIds.length === 3,
    "Expected exactly three constitutional child brains",
  );
  invariant(
    new Set(hierarchy.childBrainIds).size === hierarchy.childBrainIds.length,
    "child brain ids must be unique",
  );
  invariant(
    hierarchy.executionBoundary.rule ===
      "Children may think locally, but only the parent executes globally.",
    "child execution rule drift detected",
  );
  invariant(
    hierarchy.executionBoundary.childrenMayMutateTreasury === false &&
      hierarchy.executionBoundary.childrenMayMutateReserve === false &&
      hierarchy.executionBoundary.childrenMayMutateArbitration === false &&
      hierarchy.executionBoundary.childrenMayMutateCanonicalState === false &&
      hierarchy.executionBoundary.parentExecutesGlobally === true,
    "execution boundary must preserve sovereign parent control",
  );

  for (const [brainId, loadTarget] of Object.entries(
    hierarchy.canonicalLoadTargets,
  )) {
    invariant(
      loadTarget === `brains/${brainId}`,
      `brain load target drift detected for ${brainId}`,
    );
  }

  invariant(
    BRAIN_REGISTRY_METADATA.parentBrain.id === hierarchy.sovereignParentBrainId,
    "parent brain metadata drift detected",
  );
  invariant(
    BRAIN_REGISTRY_METADATA.parentBrain.loadPath ===
      hierarchy.canonicalLoadTargets[hierarchy.sovereignParentBrainId],
    "parent brain load path drift detected",
  );
  invariant(
    BRAIN_REGISTRY_METADATA.childBrains.length === hierarchy.childBrainIds.length,
    "child brain metadata count drift detected",
  );
  for (const childBrainId of hierarchy.childBrainIds) {
    invariant(
      BRAIN_REGISTRY_METADATA.childBrains.some((brain) => brain.id === childBrainId),
      `missing child brain metadata for ${childBrainId}`,
    );
  }

  const security = cfg.securityPolicy;
  invariant(
    security.idempotency.windowMs > 0,
    "idempotency window must be > 0",
  );
  invariant(
    security.replayProtection.ttlMs >= security.idempotency.windowMs,
    "replay TTL should be >= idempotency window",
  );
  invariant(security.spendCaps.epochMs > 0, "epochMs must be > 0");
  assertBps(
    security.spendCaps.maxOutflowPerEpochBpsOfAvailable,
    "maxOutflowPerEpochBpsOfAvailable",
  );
  assertBps(
    security.spendCaps.maxBuybackPerEpochBpsOfAvailable,
    "maxBuybackPerEpochBpsOfAvailable",
  );
  assertBps(
    security.spendCaps.maxTradingNotionalPerEpochBpsOfAvailable,
    "maxTradingNotionalPerEpochBpsOfAvailable",
  );
  assertBps(security.slippage.maxBuybackSlippageBps, "maxBuybackSlippageBps");
  assertBps(security.slippage.maxTradeSlippageBps, "maxTradeSlippageBps");
  assertBps(
    security.lossLimits.maxDailyLossBpsOfTradingWallet,
    "maxDailyLossBpsOfTradingWallet",
  );

  const requiredRoles: ActorRole[] = [
    "AGENT_CORE",
    "ARBITER",
    "TREASURY_ROUTER",
    "TRADING_EXECUTOR",
    "AUDIT_WRITER",
    "CHILD_BRAIN_GATEWAY",
  ];

  for (const role of requiredRoles) {
    invariant(security.roles.includes(role), `Missing required role: ${role}`);
  }

  invariant(
    cfg.canonicalStatePolicy.appendOnlyAuditLog === true,
    "audit log must remain append-only",
  );
  invariant(
    cfg.canonicalStatePolicy.noClientTrustedEconomicState === true &&
      cfg.canonicalStatePolicy.noSecretLeakageToClient === true &&
      cfg.canonicalStatePolicy.roleSeparation === true &&
      cfg.canonicalStatePolicy.noSilentPolicyDrift === true,
    "canonical state safeguards must remain enabled",
  );
  invariant(
    cfg.implementationAuthorityPolicy.readmeIsPolicyTruth === false,
    "README must not become the policy truth source",
  );
  invariant(
    cfg.implementationAuthorityPolicy.canonicalDocuments.includes(
      "docs/CONSTITUTION.md",
    ) &&
      cfg.implementationAuthorityPolicy.canonicalDocuments.includes(
        "docs/ECONOMIC_POLICY.md",
      ) &&
      cfg.implementationAuthorityPolicy.canonicalDocuments.includes(
        "docs/CHILD_PARENT_CONSTITUTION.md",
      ) &&
      cfg.implementationAuthorityPolicy.canonicalDocuments.includes(
        "docs/IMPLEMENTATION_NOTES.md",
      ),
    "canonical document set is incomplete",
  );
}

export function getPublicConstitutionState(
  cfg: ReadonlyDeep<ConstitutionConfig> = CONSTITUTION,
): PublicConstitutionState {
  return {
    meta: cfg.meta,
    units: {
      lamportsPerSol: lamportsToJson(cfg.units.lamportsPerSol),
      bpsDenominator: cfg.units.bpsDenominator,
    },
    reserve: getPublicEconomicState(cfg).reserve,
    economics: getPublicEconomicState(cfg),
    parentChild: {
      sovereignParentBrainId: cfg.parentChildPolicy.sovereignParentBrainId,
      sovereignParentDisplayName:
        cfg.parentChildPolicy.sovereignParentDisplayName,
      childBrainIds: cfg.parentChildPolicy.childBrainIds,
      canonicalLoadTargets: cfg.parentChildPolicy.canonicalLoadTargets,
      executionBoundary: cfg.parentChildPolicy.executionBoundary,
    },
    canonicalState: cfg.canonicalStatePolicy,
    security: {
      idempotencyWindowMs: cfg.securityPolicy.idempotency.windowMs,
      epochMs: cfg.securityPolicy.spendCaps.epochMs,
      maxDailyLossBps:
        cfg.securityPolicy.lossLimits.maxDailyLossBpsOfTradingWallet,
      circuitBreaker: cfg.securityPolicy.circuitBreaker,
      replayProtection: cfg.securityPolicy.replayProtection,
    },
    governance: cfg.governancePolicy,
    social: cfg.socialCapitalPolicy,
    rights: cfg.merkleRightsPolicy,
    implementationAuthority: cfg.implementationAuthorityPolicy,
    brainState: {
      parentBrainId: cfg.parentChildPolicy.sovereignParentBrainId,
      childBrainIds: cfg.parentChildPolicy.childBrainIds,
      canonicalLoadTargets: cfg.parentChildPolicy.canonicalLoadTargets,
      executionRule: cfg.parentChildPolicy.executionBoundary.rule,
      childBrainCount: cfg.parentChildPolicy.childBrainIds.length,
    },
  };
}

export const AUDIT_EVENT_TYPES: ReadonlyArray<AuditEventType> = [
  "REVENUE_RECEIVED",
  "ROUTING_PLAN_CREATED",
  "CREATOR_FEES_ROUTED",
  "BILLBOARD_REVENUE_ROUTED",
  "BUYBACK_AUTHORIZED",
  "BUYBACK_PLANNED",
  "BUYBACK_EXECUTED",
  "BURN_AUTHORIZED",
  "BURN_EXECUTED",
  "TRADE_AUTHORIZED",
  "TRADE_PLANNED",
  "TRADE_EXECUTED",
  "TRADING_PROFIT_ALLOCATED",
  "LIQUIDITY_PROVISIONED",
  "ARBITRATION_DECISION",
  "GOVERNANCE_DECISION",
  "RIGHTS_MERKLE_ROOT_ROTATED",
  "CLAIM_CONSUMED",
  "REPLAY_DETECTED",
  "IDEMPOTENCY_HIT",
  "RATE_LIMITED",
  "CIRCUIT_BREAKER_TRIGGERED",
  "CIRCUIT_BREAKER_TRIPPED",
  "CIRCUIT_BREAKER_RESET",
  "EMERGENCY_ACTION",
  "CONSTITUTION_DIVERGENCE",
  "CHILD_PROPOSAL_RECEIVED",
  "CHILD_PROPOSAL_DENIED",
  "CHILD_PROPOSAL_ESCALATED",
  "CHILD_BRAIN_ACTION_REQUESTED",
  "CHILD_BRAIN_ACTION_REJECTED",
] as const;

export const CONSTITUTION: ReadonlyDeep<ConstitutionConfig> =
  deepFreeze<ConstitutionConfig>({
    meta: {
      protocol: "Interloper Protocol",
      agent: "GoonClaw",
      version: "0.2.0",
      effectiveDate: "2026-03-23",
    },

    units: {
      lamportsPerSol: LAMPORTS_PER_SOL,
      bpsDenominator: BPS_DENOMINATOR,
    },

    reservePolicy: {
      reserveFloorLamports: solToLamports("0.69420"),
      reserveFloorSol: "0.69420",
    },

    treasuryPolicy: {
      creatorFees: {
        agentShareBps: 5100,
        buybackBurnBps: 4000,
        tradingWalletBps: 1100,
      },

      billboard: {
        priceLamports: solToLamports("0.01"),
        priceSol: "0.01",
        allocation: {
          buybackBurnBps: 5000,
          tradingWalletBps: 5000,
        },
      },

      tradingProfitAboveReserve: {
        governanceBranchBps: 5000,
        founderBps: 1000,
        retainedBps: 4000,
        governanceBranchModes: ["liquidity", "buybackBurn"],
      },
    },

    arbitrationPolicy: {
      goonclawIsCoFounder: true,
      represents: ["traders", "holders"],
      actsBetween: [
        "developer",
        "deployer",
        "token_buyers",
        "traders",
        "holders",
        "token_mint",
      ],
      deterministicOrdering: {
        fields: ["priority", "timestamp", "weight", "tieBreakKey"],
        tieBreak: "lexicographic",
      },
    },

    governancePolicy: {
      profitBranch: {
        allowed: ["liquidity", "buybackBurn"],
        defaultMode: "liquidity",
        mechanism: "community_vote",
        decisionCooldownMs: 60 * 60 * 1000,
      },
    },

    socialCapitalPolicy: {
      dualMandate: true,
      goal: "most_followed_agent_kol",
      channels: [
        "MyGoonClaw",
        "GoonBook",
        "GoonConnect",
        "BolClaw",
        "Trenchstroker",
        "OutOfOrder",
        "X",
        "Livestream",
      ],
      publishIsTreasuryGrowth: true,
      agenticKOLs: {
        enabled: true,
        reason: "platform_bans_and_distribution",
      },
    },

    parentChildPolicy: {
      sovereignParentBrainId: "goonclaw",
      sovereignParentDisplayName: "GoonClaw Core",
      childBrainIds: ["bolclaw", "trenchstroker", "outoforder"],
      canonicalLoadTargets: {
        goonclaw: "brains/goonclaw",
        bolclaw: "brains/bolclaw",
        trenchstroker: "brains/trenchstroker",
        outoforder: "brains/outoforder",
      },
      executionBoundary: {
        rule: "Children may think locally, but only the parent executes globally.",
        childrenMayPropose: true,
        childrenMayPublish: true,
        childrenMaySurfaceWalletIntel: true,
        childrenMayMutateTreasury: false,
        childrenMayMutateReserve: false,
        childrenMayMutateArbitration: false,
        childrenMayMutateCanonicalState: false,
        parentExecutesGlobally: true,
      },
    },

    canonicalStatePolicy: {
      singleWriterBrainId: "goonclaw",
      appendOnlyAuditLog: true,
      roleSeparation: true,
      noClientTrustedEconomicState: true,
      noSecretLeakageToClient: true,
      rightsMerkleProofDoctrine: true,
      noSilentPolicyDrift: true,
    },

    merkleRightsPolicy: {
      enabled: true,
      hash: "sha256",
      claimExpiryMs: 30 * 24 * 60 * 60 * 1000,
      rootRotationCooldownMs: 7 * 24 * 60 * 60 * 1000,
      consumedClaimsRegistryTtlMs: 90 * 24 * 60 * 60 * 1000,
    },

    securityPolicy: {
      idempotency: {
        enabled: true,
        windowMs: 10 * 60 * 1000,
        headerKey: "Idempotency-Key",
      },

      nonce: {
        strategy: "monotonic_per_scope",
        scope: ["actor", "wallet", "action"],
        minBytes: 16,
      },

      rateLimits: {
        publicRpsPerIp: 5,
        mutateRpmPerWallet: 30,
        burst: 10,
      },

      spendCaps: {
        epochMs: 60 * 60 * 1000,
        maxOutflowPerEpochBpsOfAvailable: 2500,
        maxBuybackPerEpochBpsOfAvailable: 1000,
        maxTradingNotionalPerEpochBpsOfAvailable: 2000,
      },

      slippage: {
        maxBuybackSlippageBps: 300,
        maxTradeSlippageBps: 500,
      },

      lossLimits: {
        maxDailyLossBpsOfTradingWallet: 2000,
      },

      circuitBreaker: {
        enabled: true,
        tripOnConsecutiveFailures: 5,
        tripOnAbnormalOutflowBps: 2500,
        tripOnMaxDailyLossBps: 2000,
        openStateMinDurationMs: 30 * 60 * 1000,
        halfOpenMaxActions: 3,
      },

      replayProtection: {
        enabled: true,
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        keyDerivation: "sha256",
        includePayloadHash: true,
      },

      cooldowns: {
        billboardPurchasePerWalletMs: 10_000,
        governanceDecisionMs: 60 * 60 * 1000,
        profitDistributionMs: 24 * 60 * 60 * 1000,
        treasuryActionMs: 5_000,
      },

      roles: [
        "PUBLIC_READER",
        "UI_CLIENT",
        "AGENT_CORE",
        "ARBITER",
        "TREASURY_ROUTER",
        "TRADING_EXECUTOR",
        "GOVERNANCE_TALLY",
        "AUDIT_WRITER",
        "EMERGENCY_OPERATOR",
        "COFOUNDER_HUMAN",
        "COFOUNDER_AGENT",
        "CHILD_BRAIN_GATEWAY",
      ],
    },

    implementationAuthorityPolicy: {
      readmeIsPolicyTruth: false,
      canonicalDocuments: [
        "docs/CONSTITUTION.md",
        "docs/ECONOMIC_POLICY.md",
        "docs/CHILD_PARENT_CONSTITUTION.md",
        "docs/IMPLEMENTATION_NOTES.md",
      ],
      publicStatusSurface: "HeartBeat",
    },

    audit: {
      eventTypes: AUDIT_EVENT_TYPES,
      retentionMs: 180 * 24 * 60 * 60 * 1000,
    },
  });

assertConstitutionInvariant(CONSTITUTION);

export const PUBLIC_CONSTITUTION_STATE =
  getPublicConstitutionState(CONSTITUTION);
export const PUBLIC_ECONOMIC_STATE = getPublicEconomicState(CONSTITUTION);
export const PUBLIC_BRAIN_STATE = getPublicBrainState(CONSTITUTION);
export const ECONOMIC_POLICY = CONSTITUTION.treasuryPolicy;
export const SECURITY_POLICY = CONSTITUTION.securityPolicy;
export const GOVERNANCE_POLICY = CONSTITUTION.governancePolicy;

export function maxBuybackSpendThisEpoch(args: {
  readonly currentTreasuryLamports: Lamports;
  readonly cfg?: ReadonlyDeep<ConstitutionConfig>;
}): Lamports {
  const cfg = (args.cfg ?? CONSTITUTION) as ReadonlyDeep<ConstitutionConfig>;
  const availableLamports = availableAboveReserve(
    args.currentTreasuryLamports,
    cfg.reservePolicy.reserveFloorLamports,
  );

  return mulLamportsBps(
    availableLamports,
    cfg.securityPolicy.spendCaps.maxBuybackPerEpochBpsOfAvailable,
  );
}
