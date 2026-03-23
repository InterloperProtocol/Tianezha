import { createHash, randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";

import { CONSTITUTION } from "@/lib/constitution";
import { getServerEnv } from "@/lib/env";
import { getAgentModelStatus } from "@/lib/server/agent-model";
import {
  AutonomousSettlementExecutor,
  createDefaultAutonomousSettlementExecutor,
} from "@/lib/server/autonomous-execution";
import {
  buildAutonomousMarketIntel,
  buildMarketCardPostBody,
  getTopTradeCardKey,
} from "@/lib/server/goonclaw-market-intel";
import {
  getConfiguredRepoMcpServerNames,
  getInstalledLocalCodexSkillNames,
  getVendoredGoonclawSkillNames,
} from "@/lib/server/goonclaw-tooling-catalog";
import {
  appendAutonomousFeedEvent,
  getAutonomousSnapshot,
  listAutonomousFeedEvents,
  setAutonomousSnapshot,
} from "@/lib/server/autonomous-store";
import { getDexterX402Status } from "@/lib/server/dexter-x402";
import { getGmgnStatus } from "@/lib/server/gmgn";
import {
  isGoonclawTelegramBroadcastEnabled,
  publishAutonomousEventToTelegram,
} from "@/lib/server/goonclaw-telegram";
import { createGoonBookPost } from "@/lib/server/goonbook";
import { getSolanaAgentRuntimeStatus } from "@/lib/server/solana-agent-runtime";
import { getWalletSolBalance } from "@/lib/server/solana";
import {
  assertAutonomousTradeAllowed,
  assertAutonomousTreasuryInstructionAllowed,
  calculateAutonomousPortfolioValueUsdc,
  getAutonomousTradeGuardrails,
  getAutonomousTransferGuardrails,
} from "@/lib/server/autonomous-treasury-policy";
import {
  AutonomousAgentStatus,
  AutonomousControlAction,
  AutonomousFeedEvent,
  AutonomousFeedEventKind,
  AutonomousRevenueBuckets,
  AutonomousRevenueClass,
  AutonomousRevenuePolicy,
  AutonomousRuntimeSummary,
  AutonomousSelfModificationProposal,
  AutonomousSettlementKind,
  AutonomousSettlementRecord,
  AutonomousTradeDirective,
  AutonomousTradePosition,
  MarketTradeCard,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";
import {
  createClosedCircuitBreakerState,
  evaluateCircuitBreaker,
} from "@/workers/security-guards";

const GOONCLAW_AGENT_ID = "goonclaw-autonomous-agent";
const GOONCLAW_PURPOSE =
  "Operate as the autonomous half of a human-agent business partnership: maximize sustainable profit, protect survival reserves, and compound value back into the GoonClaw token through enforced buyback-and-burn flows.";
const MAX_SETTLEMENT_HISTORY = 60;
const MAX_TRADE_DIRECTIVES = 24;
const MAX_SELF_MOD_PROPOSALS = 24;
const AUTONOMOUS_MARKET_INTEL_TIMEOUT_MS = 1_200;

type DirectiveBucketKey = "tradingUsdc" | "sessionTradeUsdc";
type RevenueBucketKey =
  | DirectiveBucketKey
  | "ownerUsdc"
  | "burnUsdc"
  | "reserveUsdc";
type AutonomousSnapshot = ReturnType<typeof getAutonomousSnapshot>;

type ControlOptions = {
  executor?: AutonomousSettlementExecutor;
};

const DISCRETIONARY_SETTLEMENT_KINDS = new Set<AutonomousSettlementKind>([
  "owner_payout",
  "buyback_burn",
  "treasury_trade",
  "session_trade",
]);

function roundUsdc(value: number) {
  return Number(value.toFixed(6));
}

function getCircuitBreakerState(snapshot: AutonomousSnapshot) {
  return snapshot.control.circuitBreakerState || createClosedCircuitBreakerState();
}

function setCircuitBreakerState(
  snapshot: AutonomousSnapshot,
  circuitBreakerState: ReturnType<typeof getCircuitBreakerState>,
) {
  return {
    ...snapshot,
    control: {
      ...snapshot.control,
      circuitBreakerState,
    },
  };
}

function isDiscretionarySettlementKind(kind: AutonomousSettlementKind) {
  return DISCRETIONARY_SETTLEMENT_KINDS.has(kind);
}

function canExecuteSettlementUnderCircuitBreaker(args: {
  circuitBreakerState: ReturnType<typeof getCircuitBreakerState>;
  kind: AutonomousSettlementKind;
  halfOpenDiscretionaryActions: number;
}) {
  if (!isDiscretionarySettlementKind(args.kind)) {
    return true;
  }

  if (args.circuitBreakerState.status === "open") {
    return false;
  }

  if (args.circuitBreakerState.status === "half_open") {
    return (
      args.halfOpenDiscretionaryActions <
      CONSTITUTION.securityPolicy.circuitBreaker.halfOpenMaxActions
    );
  }

  return true;
}

function emitCircuitBreakerTransition(args: {
  previous: ReturnType<typeof getCircuitBreakerState>;
  next: ReturnType<typeof getCircuitBreakerState>;
  reason: string;
}) {
  if (
    args.previous.status === args.next.status &&
    args.previous.reason === args.next.reason
  ) {
    return;
  }

  const title =
    args.next.status === "open"
      ? "Circuit breaker opened"
      : args.next.status === "half_open"
        ? "Circuit breaker probing"
        : "Circuit breaker reset";
  const detail =
    args.next.status === "open"
      ? args.reason
      : args.next.status === "half_open"
        ? "Open-state cooldown elapsed; one discretionary settlement may probe the runtime."
        : "Discretionary settlement health recovered and the breaker closed.";

  emitAutonomousFeedEvent(
    createEvent("policy", title, detail, [
      `previous=${args.previous.status}`,
      `next=${args.next.status}`,
      `reason=${args.next.reason || "n/a"}`,
      `consecutiveFailures=${args.next.consecutiveFailures}`,
    ]),
  );
}

function applyCircuitBreakerState(args: {
  snapshot: AutonomousSnapshot;
  circuitBreakerState: ReturnType<typeof getCircuitBreakerState>;
  reason: string;
}) {
  const previousState = getCircuitBreakerState(args.snapshot);
  emitCircuitBreakerTransition({
    previous: previousState,
    next: args.circuitBreakerState,
    reason: args.reason,
  });
  return setCircuitBreakerState(args.snapshot, args.circuitBreakerState);
}

function recordCircuitBreakerSuccess(snapshot: AutonomousSnapshot) {
  const currentState = getCircuitBreakerState(snapshot);
  return applyCircuitBreakerState({
    snapshot,
    circuitBreakerState: evaluateCircuitBreaker({
      state: currentState,
      consecutiveFailures: 0,
    }),
    reason: "A discretionary settlement succeeded.",
  });
}

function recordCircuitBreakerFailure(
  snapshot: AutonomousSnapshot,
  reason: string,
) {
  const nowMs = Date.now();
  const currentState = getCircuitBreakerState(snapshot);
  const consecutiveFailures = currentState.consecutiveFailures + 1;
  const nextState =
    currentState.status === "half_open"
      ? {
          status: "open" as const,
          openedAtMs: nowMs,
          reason: "consecutive-failures",
          consecutiveFailures,
          lastUpdatedAtMs: nowMs,
        }
      : evaluateCircuitBreaker({
          state: currentState,
          nowMs,
          consecutiveFailures,
        });

  return applyCircuitBreakerState({
    snapshot,
    circuitBreakerState: nextState,
    reason,
  });
}

function trimTail<T>(items: T[], limit: number) {
  return items.length <= limit ? items : items.slice(items.length - limit);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function createEvent(
  kind: AutonomousFeedEventKind,
  title: string,
  detail: string,
  rawTrace: string[],
): AutonomousFeedEvent {
  return {
    createdAt: nowIso(),
    detail,
    id: randomUUID(),
    kind,
    rawTrace,
    title,
  };
}

function summarizeTradeCard(card: MarketTradeCard) {
  return `${card.symbol} ${card.signalScore} | mc ${Math.round(
    card.marketCapUsd,
  ).toLocaleString()} | liq ${Math.round(card.liquidityUsd).toLocaleString()} | wallets ${
    card.walletCount ?? 0
  }`;
}

function buildRuntimeAutoTradeRationale(card: MarketTradeCard) {
  return `${card.headline}. ${card.summary} Signal score ${card.signalScore}.`;
}

function emitAutonomousFeedEvent(event: AutonomousFeedEvent) {
  appendAutonomousFeedEvent(event);
  void publishAutonomousEventToTelegram(event).catch(() => null);
}

function summarizeAutonomousSocialPost(body: string) {
  const normalized = body.trim().replace(/\s+/g, " ");
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157).trimEnd()}...`;
}

export async function publishAutonomousGoonBookPost(input: {
  body: string;
  tokenSymbol?: string | null;
  stance?: string | null;
  imageAlt?: string | null;
  imageUrl?: string | null;
  mediaCategory?: string | null;
  mediaRating?: string | null;
  tradeCard?: MarketTradeCard | null;
  snapshot?: AutonomousSnapshot;
  latestPolicyDecision?: string;
  eventTitle?: string;
  eventDetail?: string;
  rawTrace?: string[];
}) {
  const post = await createGoonBookPost({
    agentId: "goonclaw",
    body: input.body,
    tokenSymbol: input.tokenSymbol,
    stance: input.stance,
    imageAlt: input.imageAlt,
    imageUrl: input.imageUrl,
    mediaCategory: input.mediaCategory,
    mediaRating: input.mediaRating,
    tradeCard: input.tradeCard,
  });

  const nextSnapshot: AutonomousSnapshot = {
    ...(input.snapshot ?? getAutonomousSnapshot()),
    latestPolicyDecision:
      input.latestPolicyDecision?.trim() || "Published a first-party BitClaw post.",
  };
  setAutonomousSnapshot(nextSnapshot);

  emitAutonomousFeedEvent(
    createEvent(
      "social",
      input.eventTitle?.trim() || "BitClaw post published",
      input.eventDetail?.trim() || summarizeAutonomousSocialPost(post.body),
      [
        `postId=${post.id}`,
        `profileId=${post.profileId}`,
        `tokenSymbol=${post.tokenSymbol || "n/a"}`,
        `stance=${post.stance || "n/a"}`,
        `image=${post.imageUrl ? "yes" : "no"}`,
        ...(input.rawTrace || []),
      ],
    ),
  );

  return {
    post,
    snapshot: nextSnapshot,
  };
}

function getConstitutionAbsolutePath() {
  return path.resolve(process.cwd(), getServerEnv().GOONCLAW_AGENT_CONSTITUTION_PATH);
}

function readConstitutionHash() {
  const constitutionPath = getConstitutionAbsolutePath();
  if (!existsSync(constitutionPath)) {
    return "missing";
  }

  return createHash("sha256")
    .update(readFileSync(constitutionPath, "utf8"))
    .digest("hex");
}

function getRepoMcpConfigPath(fileName: string) {
  return path.resolve(process.cwd(), "services/goonclaw-automaton/mcp", fileName);
}

function hasSolanaMcpBridgeConfig() {
  return existsSync(getRepoMcpConfigPath("solana-mcp.config.json"));
}

function hasConwayCodexMcpBridgeConfig() {
  return existsSync(getRepoMcpConfigPath("conway-codex.config.json"));
}

function hasTavilyMcpBridgeConfig() {
  return existsSync(getRepoMcpConfigPath("tavily-mcp.config.json"));
}

function hasContext7McpBridgeConfig() {
  return existsSync(getRepoMcpConfigPath("context7-mcp.config.json"));
}

function hasTaskMasterMcpBridgeConfig() {
  return existsSync(getRepoMcpConfigPath("taskmaster-mcp.config.json"));
}

function hasExcelMcpBridgeConfig() {
  return existsSync(getRepoMcpConfigPath("excel-mcp.config.json"));
}

function isConwayTerminalReady() {
  const env = getServerEnv();
  return hasConwayCodexMcpBridgeConfig() && Boolean(env.CONWAY_API_KEY.trim());
}

function getReplicaExecutionScope() {
  return isConwayTerminalReady()
    ? "google-cloud-primary-conway-fallback"
    : "google-cloud-primary";
}

function settlementEventKind(kind: AutonomousSettlementKind): AutonomousFeedEventKind {
  if (kind === "buyback_burn") return "burn";
  if (
    kind === "treasury_trade" ||
    kind === "session_trade" ||
    kind === "position_liquidation"
  ) {
    return "trade";
  }

  return "decision";
}

function directiveBucketFromRevenueClass(
  revenueClass: AutonomousRevenueClass,
): DirectiveBucketKey {
  return revenueClass === "goonclaw_chartsync" ? "sessionTradeUsdc" : "tradingUsdc";
}

function bucketForPositionSource(
  source: AutonomousTradePosition["source"],
): DirectiveBucketKey {
  return source === "goonclaw_chartsync" ? "sessionTradeUsdc" : "tradingUsdc";
}

function decrementBucket(
  buckets: AutonomousRevenueBuckets,
  bucket: RevenueBucketKey,
  amountUsdc: number,
) {
  return {
    ...buckets,
    [bucket]: roundUsdc(Math.max(0, buckets[bucket] - amountUsdc)),
  };
}

function incrementDirectiveBucket(
  buckets: AutonomousRevenueBuckets,
  bucket: DirectiveBucketKey,
  amountUsdc: number,
) {
  return {
    ...buckets,
    [bucket]: roundUsdc(buckets[bucket] + amountUsdc),
  };
}

function getRevenuePolicies(): AutonomousRevenuePolicy[] {
  const creatorFees = CONSTITUTION.treasuryPolicy.creatorFees;
  const creatorAgentSharePct = Math.round(creatorFees.agentShareBps / 100);
  const creatorBurnPct = Math.round(creatorFees.buybackBurnBps / 100);
  const creatorTradingPct = Math.round(creatorFees.tradingWalletBps / 100);
  const creatorExternalPct = Math.max(0, 100 - creatorAgentSharePct);

  return [
    {
      revenueClass: "creator_fee",
      ownerPct: creatorExternalPct,
      burnPct: creatorBurnPct,
      reservePct: 0,
      tradingPct: creatorTradingPct,
      sessionTradePct: 0,
      notes:
        `Creator fees route ${creatorAgentSharePct}% into GoonClaw control: ${creatorBurnPct}% buyback-and-burn plus ${creatorTradingPct}% agent trading. The remaining ${creatorExternalPct}% currently stays in the external payout bucket.`,
    },
    {
      revenueClass: "goonclaw_chartsync",
      ownerPct: 0,
      burnPct: 50,
      reservePct: 0,
      tradingPct: 0,
      sessionTradePct: 50,
      notes:
        "GoonClaw-owned ChartSync sessions split 50% burn and 50% session trade, and the queued session trade may execute only after a Pump-verified target passes the 10% portfolio cap.",
    },
    {
      revenueClass: "third_party_chartsync_commission",
      ownerPct: 0,
      burnPct: 5,
      reservePct: 5,
      tradingPct: 0,
      sessionTradePct: 0,
      notes:
        "Third-party public streams route GoonClaw commission 5% to burn and 5% to reserve; extra trading remains policy-driven.",
    },
  ];
}

export function applyAutonomousRevenueAllocation(
  revenueClass: AutonomousRevenueClass,
  amountUsdc: number,
  buckets: AutonomousRevenueBuckets,
) {
  const policy = getRevenuePolicies().find((item) => item.revenueClass === revenueClass);
  if (!policy) {
    throw new Error(`Missing revenue policy for ${revenueClass}`);
  }

  const allocated = {
    burnUsdc: roundUsdc((amountUsdc * policy.burnPct) / 100),
    ownerUsdc: roundUsdc((amountUsdc * policy.ownerPct) / 100),
    reserveUsdc: roundUsdc((amountUsdc * policy.reservePct) / 100),
    sessionTradeUsdc: roundUsdc((amountUsdc * policy.sessionTradePct) / 100),
    tradingUsdc: roundUsdc((amountUsdc * policy.tradingPct) / 100),
  };

  return {
    allocated,
    nextBuckets: {
      burnUsdc: roundUsdc(buckets.burnUsdc + allocated.burnUsdc),
      ownerUsdc: roundUsdc(buckets.ownerUsdc + allocated.ownerUsdc),
      reserveUsdc: roundUsdc(buckets.reserveUsdc + allocated.reserveUsdc),
      sessionTradeUsdc: roundUsdc(
        buckets.sessionTradeUsdc + allocated.sessionTradeUsdc,
      ),
      totalProcessedUsdc: roundUsdc(buckets.totalProcessedUsdc + amountUsdc),
      tradingUsdc: roundUsdc(buckets.tradingUsdc + allocated.tradingUsdc),
    },
    policy,
  };
}

export function recordAutonomousRevenue(
  revenueClass: AutonomousRevenueClass,
  amountUsdc: number,
  label: string,
) {
  const snapshot = getAutonomousSnapshot();
  const { allocated, nextBuckets, policy } = applyAutonomousRevenueAllocation(
    revenueClass,
    amountUsdc,
    snapshot.revenueBuckets,
  );

  const nextSnapshot = {
    ...snapshot,
    latestPolicyDecision:
      allocated.sessionTradeUsdc > 0
        ? `Allocated ${amountUsdc.toFixed(2)} USDC from ${label}; session trade capital is live once a Pump-verified directive exists.`
        : `Allocated ${amountUsdc.toFixed(2)} USDC from ${label} under ${policy.revenueClass}.`,
    revenueBuckets: nextBuckets,
  };

  setAutonomousSnapshot(nextSnapshot);
  emitAutonomousFeedEvent(
    createEvent("revenue", "Revenue allocated", `${label} processed.`, [
      `policy=${policy.revenueClass}`,
      `amountUsdc=${amountUsdc.toFixed(6)}`,
      `owner=${allocated.ownerUsdc.toFixed(6)}`,
      `burn=${allocated.burnUsdc.toFixed(6)}`,
      `reserve=${allocated.reserveUsdc.toFixed(6)}`,
      `trading=${allocated.tradingUsdc.toFixed(6)}`,
      `sessionTrade=${allocated.sessionTradeUsdc.toFixed(6)}`,
    ]),
  );

  return nextBuckets;
}

function replaceSettlements(
  settlements: AutonomousSettlementRecord[],
  settlementId: string,
  updater: (current: AutonomousSettlementRecord) => AutonomousSettlementRecord,
) {
  return settlements.map((settlement) =>
    settlement.id === settlementId ? updater(settlement) : settlement,
  );
}

function replaceDirectives(
  directives: AutonomousTradeDirective[],
  directiveId: string,
  updater: (current: AutonomousTradeDirective) => AutonomousTradeDirective,
) {
  return directives.map((directive) =>
    directive.id === directiveId ? updater(directive) : directive,
  );
}

function replacePositions(
  positions: AutonomousTradePosition[],
  positionId: string,
  updater: (current: AutonomousTradePosition) => AutonomousTradePosition,
) {
  return positions.map((position) =>
    position.id === positionId ? updater(position) : position,
  );
}

function createSettlementRecord(args: {
  amountUsdc: number;
  bucket?: RevenueBucketKey | null;
  directiveId?: string | null;
  kind: AutonomousSettlementKind;
  marketMint?: string | null;
  positionId?: string | null;
  revenueClass?: AutonomousRevenueClass | null;
  symbol?: string | null;
}) {
  const timestamp = nowIso();
  return {
    amountUsdc: roundUsdc(args.amountUsdc),
    attempts: 0,
    bucket: args.bucket || null,
    directiveId: args.directiveId || null,
    id: randomUUID(),
    kind: args.kind,
    lastError: null,
    lastOutcome: null,
    marketMint: args.marketMint || null,
    positionId: args.positionId || null,
    requestedAt: timestamp,
    revenueClass: args.revenueClass || null,
    status: "queued" as const,
    symbol: args.symbol || null,
    txSignatures: [],
    updatedAt: timestamp,
  } satisfies AutonomousSettlementRecord;
}

function queueTradeDirectiveIntoSnapshot(
  snapshot: AutonomousSnapshot,
  args: {
    bucket: DirectiveBucketKey;
    isPumpCoin: boolean;
    marketMint: string;
    queuedBy: "owner" | "runtime";
    rationale: string;
    requestedUsdc: number;
    revenueClass: AutonomousRevenueClass;
    symbol: string;
  },
) {
  const requestedUsdc = roundUsdc(args.requestedUsdc);
  if (requestedUsdc <= 0) {
    throw new Error("Trade directives must request a positive USDC amount.");
  }

  if (snapshot.revenueBuckets[args.bucket] < requestedUsdc) {
    throw new Error(
      `The ${args.bucket} bucket does not currently hold ${requestedUsdc.toFixed(2)} USDC.`,
    );
  }

  if (
    snapshot.tradeDirectives.some(
      (directive) =>
        directive.status === "queued" &&
        directive.marketMint === args.marketMint &&
        directive.bucket === args.bucket,
    )
  ) {
    throw new Error("A queued directive for this mint already exists.");
  }

  if (
    snapshot.positions.some(
      (position) =>
        position.status === "open" && position.marketMint === args.marketMint,
    )
  ) {
    throw new Error("An open position for this mint already exists.");
  }

  const portfolioValueUsdc = Math.max(
    requestedUsdc,
    calculateAutonomousPortfolioValueUsdc({
      positions: snapshot.positions,
      revenueBuckets: snapshot.revenueBuckets,
      usdcBalance: snapshot.usdcBalance,
    }),
  );

  assertAutonomousTradeAllowed({
    assetMint: args.marketMint,
    currentPositionUsdc: 0,
    isPumpCoin: args.isPumpCoin,
    portfolioValueUsdc,
    requestedNotionalUsdc: requestedUsdc,
    venue: "gmgn",
  });

  const directive: AutonomousTradeDirective = {
    bucket: args.bucket,
    id: randomUUID(),
    isPumpCoin: args.isPumpCoin,
    lastOutcome: null,
    marketMint: args.marketMint,
    positionId: null,
    queuedAt: nowIso(),
    queuedBy: args.queuedBy,
    rationale: args.rationale,
    requestedUsdc,
    revenueClass: args.revenueClass,
    status: "queued",
    symbol: args.symbol,
  };

  return {
    directive,
    nextSnapshot: {
      ...snapshot,
      latestPolicyDecision: `Queued trade directive for ${directive.symbol}.`,
      tradeDirectives: trimTail(
        [...snapshot.tradeDirectives, directive],
        MAX_TRADE_DIRECTIVES,
      ),
    },
  };
}

function syncAutoTradeDirectives(snapshot: AutonomousSnapshot) {
  let nextSnapshot = snapshot;
  const hasQueuedDirectiveForBucket = (bucket: DirectiveBucketKey) =>
    nextSnapshot.tradeDirectives.some(
      (directive) => directive.status === "queued" && directive.bucket === bucket,
    );
  const treasuryMint =
    nextSnapshot.selfModification.currentTuning.preferredTreasuryTradeMint?.trim() ||
    "";
  const treasurySymbol =
    nextSnapshot.selfModification.currentTuning.preferredTreasuryTradeSymbol?.trim() ||
    "";
  if (
    treasuryMint &&
    treasurySymbol &&
    nextSnapshot.revenueBuckets.tradingUsdc > 0 &&
    !hasQueuedDirectiveForBucket("tradingUsdc") &&
    !nextSnapshot.tradeDirectives.some(
      (directive) =>
        directive.status === "queued" &&
        directive.marketMint === treasuryMint &&
        directive.bucket === "tradingUsdc",
    ) &&
    !nextSnapshot.positions.some(
      (position) =>
        position.status === "open" && position.marketMint === treasuryMint,
    )
  ) {
    nextSnapshot = queueTradeDirectiveIntoSnapshot(nextSnapshot, {
      bucket: "tradingUsdc",
      isPumpCoin: true,
      marketMint: treasuryMint,
      queuedBy: "runtime",
      rationale:
        "Approved self-mod tuning auto-directed the creator-fee trading bucket.",
      requestedUsdc: nextSnapshot.revenueBuckets.tradingUsdc,
      revenueClass: "creator_fee",
      symbol: treasurySymbol,
    }).nextSnapshot;
  }

  const marketIntelMint = nextSnapshot.marketIntel.nextTradeCandidateMint?.trim() || "";
  const marketIntelSymbol =
    nextSnapshot.marketIntel.nextTradeCandidateSymbol?.trim() || "";
  const marketIntelCard =
    nextSnapshot.marketIntel.tradeCards.find(
      (card) => card.mint === marketIntelMint || card.symbol === marketIntelSymbol,
    ) || null;

  if (
    !treasuryMint &&
    marketIntelMint &&
    marketIntelSymbol &&
    nextSnapshot.revenueBuckets.tradingUsdc > 0 &&
    !hasQueuedDirectiveForBucket("tradingUsdc") &&
    !nextSnapshot.tradeDirectives.some(
      (directive) =>
        directive.status === "queued" &&
        directive.marketMint === marketIntelMint &&
        directive.bucket === "tradingUsdc",
    ) &&
    !nextSnapshot.positions.some(
      (position) =>
        position.status === "open" && position.marketMint === marketIntelMint,
    )
  ) {
    nextSnapshot = queueTradeDirectiveIntoSnapshot(nextSnapshot, {
      bucket: "tradingUsdc",
      isPumpCoin: true,
      marketMint: marketIntelMint,
      queuedBy: "runtime",
      rationale: marketIntelCard
        ? buildRuntimeAutoTradeRationale(marketIntelCard)
        : "Heartbeat market model selected the strongest live candidate.",
      requestedUsdc: nextSnapshot.revenueBuckets.tradingUsdc,
      revenueClass: "creator_fee",
      symbol: marketIntelSymbol,
    }).nextSnapshot;
  }

  const sessionMint =
    nextSnapshot.selfModification.currentTuning.preferredSessionTradeMint?.trim() ||
    "";
  const sessionSymbol =
    nextSnapshot.selfModification.currentTuning.preferredSessionTradeSymbol?.trim() ||
    "";
  if (
    sessionMint &&
    sessionSymbol &&
    nextSnapshot.revenueBuckets.sessionTradeUsdc > 0 &&
    !hasQueuedDirectiveForBucket("sessionTradeUsdc") &&
    !nextSnapshot.tradeDirectives.some(
      (directive) =>
        directive.status === "queued" &&
        directive.marketMint === sessionMint &&
        directive.bucket === "sessionTradeUsdc",
    ) &&
    !nextSnapshot.positions.some(
      (position) =>
        position.status === "open" && position.marketMint === sessionMint,
    )
  ) {
    nextSnapshot = queueTradeDirectiveIntoSnapshot(nextSnapshot, {
      bucket: "sessionTradeUsdc",
      isPumpCoin: true,
      marketMint: sessionMint,
      queuedBy: "runtime",
      rationale:
        "Approved self-mod tuning auto-directed the ChartSync session trading bucket.",
      requestedUsdc: nextSnapshot.revenueBuckets.sessionTradeUsdc,
      revenueClass: "goonclaw_chartsync",
      symbol: sessionSymbol,
    }).nextSnapshot;
  }

  if (
    !sessionMint &&
    marketIntelMint &&
    marketIntelSymbol &&
    nextSnapshot.revenueBuckets.sessionTradeUsdc > 0 &&
    !hasQueuedDirectiveForBucket("sessionTradeUsdc") &&
    !nextSnapshot.tradeDirectives.some(
      (directive) =>
        directive.status === "queued" &&
        directive.marketMint === marketIntelMint &&
        directive.bucket === "sessionTradeUsdc",
    ) &&
    !nextSnapshot.positions.some(
      (position) =>
        position.status === "open" && position.marketMint === marketIntelMint,
    )
  ) {
    nextSnapshot = queueTradeDirectiveIntoSnapshot(nextSnapshot, {
      bucket: "sessionTradeUsdc",
      isPumpCoin: true,
      marketMint: marketIntelMint,
      queuedBy: "runtime",
      rationale: marketIntelCard
        ? buildRuntimeAutoTradeRationale(marketIntelCard)
        : "Heartbeat market model selected the strongest session-trade candidate.",
      requestedUsdc: nextSnapshot.revenueBuckets.sessionTradeUsdc,
      revenueClass: "goonclaw_chartsync",
      symbol: marketIntelSymbol,
    }).nextSnapshot;
  }

  return nextSnapshot;
}

function syncSettlementQueue(snapshot: AutonomousSnapshot) {
  let nextSnapshot = syncAutoTradeDirectives(snapshot);
  const hasActive = (matcher: (settlement: AutonomousSettlementRecord) => boolean) =>
    nextSnapshot.settlements.some(
      (settlement) =>
        (settlement.status === "queued" || settlement.status === "running") &&
        matcher(settlement),
    );

  if (
    nextSnapshot.revenueBuckets.ownerUsdc > 0 &&
    !hasActive((settlement) => settlement.kind === "owner_payout")
  ) {
    nextSnapshot = {
      ...nextSnapshot,
      settlements: trimTail(
        [
          ...nextSnapshot.settlements,
          createSettlementRecord({
            amountUsdc: nextSnapshot.revenueBuckets.ownerUsdc,
            bucket: "ownerUsdc",
            kind: "owner_payout",
          }),
        ],
        MAX_SETTLEMENT_HISTORY,
      ),
    };
  }

  if (
    nextSnapshot.revenueBuckets.burnUsdc > 0 &&
    !hasActive((settlement) => settlement.kind === "buyback_burn")
  ) {
    nextSnapshot = {
      ...nextSnapshot,
      settlements: trimTail(
        [
          ...nextSnapshot.settlements,
          createSettlementRecord({
            amountUsdc: nextSnapshot.revenueBuckets.burnUsdc,
            bucket: "burnUsdc",
            kind: "buyback_burn",
          }),
        ],
        MAX_SETTLEMENT_HISTORY,
      ),
    };
  }

  if (
    nextSnapshot.revenueBuckets.reserveUsdc > 0 &&
    !hasActive((settlement) => settlement.kind === "reserve_rebalance")
  ) {
    nextSnapshot = {
      ...nextSnapshot,
      settlements: trimTail(
        [
          ...nextSnapshot.settlements,
          createSettlementRecord({
            amountUsdc: nextSnapshot.revenueBuckets.reserveUsdc,
            bucket: "reserveUsdc",
            kind: "reserve_rebalance",
          }),
        ],
        MAX_SETTLEMENT_HISTORY,
      ),
    };
  }

  for (const directive of nextSnapshot.tradeDirectives) {
    if (directive.status !== "queued") continue;
    if (nextSnapshot.revenueBuckets[directive.bucket] < directive.requestedUsdc) continue;
    if (hasActive((settlement) => settlement.directiveId === directive.id)) continue;

    nextSnapshot = {
      ...nextSnapshot,
      settlements: trimTail(
        [
          ...nextSnapshot.settlements,
          createSettlementRecord({
            amountUsdc: directive.requestedUsdc,
            bucket: directive.bucket,
            directiveId: directive.id,
            kind:
              directive.bucket === "sessionTradeUsdc"
                ? "session_trade"
                : "treasury_trade",
            marketMint: directive.marketMint,
            revenueClass: directive.revenueClass,
            symbol: directive.symbol,
          }),
        ],
        MAX_SETTLEMENT_HISTORY,
      ),
    };
  }

  return nextSnapshot;
}

function queueLiquidationJobs(snapshot: AutonomousSnapshot) {
  let nextSnapshot = snapshot;

  for (const position of nextSnapshot.positions) {
    if (position.status !== "open") continue;

    const active = nextSnapshot.settlements.some(
      (settlement) =>
        (settlement.status === "queued" || settlement.status === "running") &&
        settlement.kind === "position_liquidation" &&
        settlement.positionId === position.id,
    );
    if (active) continue;

    nextSnapshot = {
      ...nextSnapshot,
      settlements: trimTail(
        [
          ...nextSnapshot.settlements,
          createSettlementRecord({
            amountUsdc: position.currentUsdc,
            kind: "position_liquidation",
            marketMint: position.marketMint,
            positionId: position.id,
            revenueClass: position.source === "reserve" ? null : position.source,
            symbol: position.symbol,
          }),
        ],
        MAX_SETTLEMENT_HISTORY,
      ),
    };
  }

  return nextSnapshot;
}

export function queueAutonomousTradeDirective(args: {
  bucket?: DirectiveBucketKey;
  isPumpCoin?: boolean;
  marketMint: string;
  rationale: string;
  requestedUsdc: number;
  revenueClass?: AutonomousRevenueClass;
  symbol: string;
}) {
  const revenueClass = args.revenueClass || "creator_fee";
  const bucket = args.bucket || directiveBucketFromRevenueClass(revenueClass);
  const snapshot = getAutonomousSnapshot();
  const { directive, nextSnapshot } = queueTradeDirectiveIntoSnapshot(snapshot, {
    bucket,
    isPumpCoin: args.isPumpCoin ?? true,
    marketMint: args.marketMint.trim(),
    queuedBy: "owner",
    rationale: args.rationale.trim(),
    requestedUsdc: args.requestedUsdc,
    revenueClass,
    symbol: args.symbol.trim(),
  });

  setAutonomousSnapshot(nextSnapshot);
  emitAutonomousFeedEvent(
    createEvent("trade", "Trade directive queued", `Queued ${directive.symbol}.`, [
      `directiveId=${directive.id}`,
      `bucket=${directive.bucket}`,
      `marketMint=${directive.marketMint}`,
      `requestedUsdc=${directive.requestedUsdc.toFixed(6)}`,
    ]),
  );

  return directive;
}

export function queueAutonomousSelfModificationProposal(args: {
  summary: string;
  title: string;
  tuningPatch: {
    preferredSessionTradeMint?: string | null;
    preferredSessionTradeSymbol?: string | null;
    preferredTreasuryTradeMint?: string | null;
    preferredTreasuryTradeSymbol?: string | null;
    replicationTemplateLabel?: string | null;
  };
}) {
  const snapshot = getAutonomousSnapshot();
  if (snapshot.selfModification.pendingProposalId) {
    throw new Error("A self-mod proposal is already pending owner review.");
  }

  const hasPatchValues = Object.values(args.tuningPatch).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (!hasPatchValues) {
    throw new Error("Self-mod proposals must include at least one runtime tuning value.");
  }

  const proposal: AutonomousSelfModificationProposal = {
    contentHash: createHash("sha256")
      .update(JSON.stringify(args.tuningPatch))
      .digest("hex"),
    createdAt: nowIso(),
    id: randomUUID(),
    proposedBy: "owner",
    reviewNote: null,
    status: "pending",
    summary: args.summary.trim(),
    title: args.title.trim(),
    tuningPatch: {
      preferredSessionTradeMint:
        args.tuningPatch.preferredSessionTradeMint?.trim() || null,
      preferredSessionTradeSymbol:
        args.tuningPatch.preferredSessionTradeSymbol?.trim() || null,
      preferredTreasuryTradeMint:
        args.tuningPatch.preferredTreasuryTradeMint?.trim() || null,
      preferredTreasuryTradeSymbol:
        args.tuningPatch.preferredTreasuryTradeSymbol?.trim() || null,
      replicationTemplateLabel:
        args.tuningPatch.replicationTemplateLabel?.trim() || null,
    },
  };

  const nextSnapshot = {
    ...snapshot,
    latestPolicyDecision: `Queued self-mod proposal: ${proposal.title}.`,
    selfModification: {
      ...snapshot.selfModification,
      lastEventAt: proposal.createdAt,
      pendingProposal: `${proposal.title}: ${proposal.summary}`,
      pendingProposalId: proposal.id,
      proposals: trimTail(
        [...snapshot.selfModification.proposals, proposal],
        MAX_SELF_MOD_PROPOSALS,
      ),
    },
  };

  setAutonomousSnapshot(nextSnapshot);
  emitAutonomousFeedEvent(
    createEvent(
      "self_mod",
      "Self-mod proposal queued",
      `${proposal.title}: ${proposal.summary}`,
      [`proposalId=${proposal.id}`, `contentHash=${proposal.contentHash}`],
    ),
  );

  return proposal;
}

function applyPendingSelfModification(
  snapshot: AutonomousSnapshot,
  note?: string,
) {
  const proposalId = snapshot.selfModification.pendingProposalId;
  const proposal = snapshot.selfModification.proposals.find(
    (item) => item.id === proposalId && item.status === "pending",
  );

  if (!proposal) {
    return {
      ...snapshot,
      latestPolicyDecision: "No pending self-mod proposal was available to apply.",
      selfModification: {
        ...snapshot.selfModification,
        lastEventAt: nowIso(),
        lastOutcome: "Owner approval attempted with no pending proposal.",
        pendingProposal: null,
        pendingProposalId: null,
      },
    };
  }

  return syncAutoTradeDirectives({
    ...snapshot,
    latestPolicyDecision: `Applied self-mod proposal: ${proposal.title}.`,
    selfModification: {
      ...snapshot.selfModification,
      currentTuning: {
        ...snapshot.selfModification.currentTuning,
        ...proposal.tuningPatch,
      },
      lastEventAt: nowIso(),
      lastOutcome:
        note || `Owner approved and applied self-mod proposal: ${proposal.title}.`,
      pendingProposal: null,
      pendingProposalId: null,
      proposals: snapshot.selfModification.proposals.map((item) =>
        item.id === proposal.id
          ? {
              ...item,
              reviewNote:
                note || `Owner approved and applied self-mod proposal: ${proposal.title}.`,
              status: "applied" as const,
            }
          : item,
      ),
    },
  });
}

function rejectPendingSelfModification(
  snapshot: AutonomousSnapshot,
  note?: string,
) {
  const proposalId = snapshot.selfModification.pendingProposalId;
  const proposal = snapshot.selfModification.proposals.find(
    (item) => item.id === proposalId && item.status === "pending",
  );

  if (!proposal) {
    return {
      ...snapshot,
      latestPolicyDecision: "No pending self-mod proposal was available to reject.",
      selfModification: {
        ...snapshot.selfModification,
        lastEventAt: nowIso(),
        lastOutcome: "Owner rejection attempted with no pending proposal.",
        pendingProposal: null,
        pendingProposalId: null,
      },
    };
  }

  return {
    ...snapshot,
    latestPolicyDecision: `Rejected self-mod proposal: ${proposal.title}.`,
    selfModification: {
      ...snapshot.selfModification,
      lastEventAt: nowIso(),
      lastOutcome: note || `Owner rejected self-mod proposal: ${proposal.title}.`,
      pendingProposal: null,
      pendingProposalId: null,
      proposals: snapshot.selfModification.proposals.map((item) =>
        item.id === proposal.id
          ? {
              ...item,
              reviewNote:
                note || `Owner rejected self-mod proposal: ${proposal.title}.`,
              status: "rejected" as const,
            }
          : item,
      ),
    },
  };
}

async function executeSettlement(
  snapshot: AutonomousSnapshot,
  settlement: AutonomousSettlementRecord,
  executor: AutonomousSettlementExecutor,
) {
  const env = getServerEnv();
  const timestamp = nowIso();

  if (settlement.kind === "owner_payout") {
    assertAutonomousTreasuryInstructionAllowed({
      destinationAddress: env.GOONCLAW_OWNER_WALLET,
      kind: "owner_payout",
    });
    const result = await executor.settleOwnerPayout({
      amountUsdc: settlement.amountUsdc,
      ownerWallet: env.GOONCLAW_OWNER_WALLET,
    });

    return {
      ...snapshot,
      latestPolicyDecision: `Settled ${settlement.amountUsdc.toFixed(2)} USDC to the configured owner wallet.`,
      revenueBuckets: decrementBucket(snapshot.revenueBuckets, "ownerUsdc", settlement.amountUsdc),
      settlements: replaceSettlements(snapshot.settlements, settlement.id, (current) => ({
        ...current,
        destinationAddress: env.GOONCLAW_OWNER_WALLET,
        lastOutcome: "Creator-fee partner payout settled.",
        status: "succeeded",
        txSignatures: [...current.txSignatures, result.signature],
        updatedAt: timestamp,
      })),
    };
  }

  if (settlement.kind === "reserve_rebalance") {
    assertAutonomousTreasuryInstructionAllowed({
      destinationAddress: env.TREASURY_WALLET,
      kind: "reserve_rebalance",
    });
    const result = await executor.settleReserveRebalance({
      amountUsdc: settlement.amountUsdc,
      treasuryWallet: env.TREASURY_WALLET,
    });

    return {
      ...snapshot,
      latestPolicyDecision: `Rebalanced ${settlement.amountUsdc.toFixed(2)} USDC into the treasury wallet.`,
      revenueBuckets: decrementBucket(snapshot.revenueBuckets, "reserveUsdc", settlement.amountUsdc),
      settlements: replaceSettlements(snapshot.settlements, settlement.id, (current) => ({
        ...current,
        destinationAddress: env.TREASURY_WALLET,
        lastOutcome: "Reserve bucket settled to the treasury wallet.",
        status: "succeeded",
        txSignatures: [...current.txSignatures, result.signature],
        updatedAt: timestamp,
      })),
    };
  }

  if (settlement.kind === "buyback_burn") {
    const result = await executor.executeBuybackBurn({
      amountUsdc: settlement.amountUsdc,
      tokenMint: env.BAGSTROKE_TOKEN_MINT,
    });

    return {
      ...snapshot,
      latestPolicyDecision: `Executed ${settlement.amountUsdc.toFixed(2)} USDC buyback-and-burn settlement.`,
      revenueBuckets: decrementBucket(snapshot.revenueBuckets, "burnUsdc", settlement.amountUsdc),
      settlements: replaceSettlements(snapshot.settlements, settlement.id, (current) => ({
        ...current,
        lastOutcome: "Buyback-and-burn settlement succeeded.",
        status: "succeeded",
        txSignatures: [...current.txSignatures, result.buySignature, result.burnSignature],
        updatedAt: timestamp,
      })),
    };
  }

  if (settlement.kind === "treasury_trade" || settlement.kind === "session_trade") {
    const directive = snapshot.tradeDirectives.find(
      (item) => item.id === settlement.directiveId,
    );
    if (!directive) {
      throw new Error("Trade directive not found for queued settlement.");
    }

    const result = await executor.executeTrade({
      amountUsdc: settlement.amountUsdc,
      marketMint: directive.marketMint,
    });
    const positionId = randomUUID();

    return {
      ...snapshot,
      latestPolicyDecision: `Opened ${directive.symbol} position for ${settlement.amountUsdc.toFixed(2)} USDC.`,
      positions: [
        ...snapshot.positions,
        {
          currentUsdc: settlement.amountUsdc,
          entrySignature: result.buySignature,
          entryUsdc: settlement.amountUsdc,
          id: positionId,
          marketMint: directive.marketMint,
          openedAt: timestamp,
          rationale: directive.rationale,
          settlementId: settlement.id,
          source: directive.revenueClass,
          status: "open" as const,
          symbol: directive.symbol,
          tokenAmountRaw: result.acquiredAmountRaw,
          venue: "gmgn" as const,
        },
      ],
      revenueBuckets: decrementBucket(snapshot.revenueBuckets, directive.bucket, settlement.amountUsdc),
      settlements: replaceSettlements(snapshot.settlements, settlement.id, (current) => ({
        ...current,
        lastOutcome: `Trade executed for ${directive.symbol}.`,
        positionId,
        status: "succeeded",
        txSignatures: [...current.txSignatures, result.buySignature],
        updatedAt: timestamp,
      })),
      tradeDirectives: replaceDirectives(snapshot.tradeDirectives, directive.id, (current) => ({
        ...current,
        lastOutcome: `Trade executed for ${current.symbol}.`,
        positionId,
        status: "executed",
      })),
    };
  }

  if (settlement.kind === "position_liquidation") {
    const position = snapshot.positions.find((item) => item.id === settlement.positionId);
    if (!position || position.status !== "open") {
      return {
        ...snapshot,
        settlements: replaceSettlements(snapshot.settlements, settlement.id, (current) => ({
          ...current,
          lastOutcome: "Open position no longer exists; liquidation skipped.",
          status: "skipped",
          updatedAt: timestamp,
        })),
      };
    }

    const result = await executor.liquidateTrade({
      marketMint: position.marketMint,
    });
    const nextBucket = bucketForPositionSource(position.source);

    return {
      ...snapshot,
      latestPolicyDecision:
        result.exitUsdc > 0
          ? `Liquidated ${position.symbol} and returned ${result.exitUsdc.toFixed(2)} USDC to ${nextBucket}.`
          : `Closed ${position.symbol} without recovered USDC.`,
      positions: replacePositions(snapshot.positions, position.id, (current) => ({
        ...current,
        closedAt: timestamp,
        currentUsdc: result.exitUsdc,
        exitSignature: result.sellSignature,
        exitUsdc: result.exitUsdc,
        status: "closed",
      })),
      revenueBuckets:
        result.exitUsdc > 0
          ? incrementDirectiveBucket(snapshot.revenueBuckets, nextBucket, result.exitUsdc)
          : snapshot.revenueBuckets,
      settlements: replaceSettlements(snapshot.settlements, settlement.id, (current) => ({
        ...current,
        lastOutcome:
          result.exitUsdc > 0
            ? `Liquidated ${position.symbol} back into USDC.`
            : `Closed ${position.symbol} without sellable balance.`,
        status: "succeeded",
        txSignatures: result.sellSignature
          ? [...current.txSignatures, result.sellSignature]
          : current.txSignatures,
        updatedAt: timestamp,
      })),
    };
  }

  return snapshot;
}

async function processSettlementQueue(args: {
  executor: AutonomousSettlementExecutor;
  maxJobs: number;
  onlyKinds?: AutonomousSettlementKind[];
  snapshot: AutonomousSnapshot;
}) {
  let nextSnapshot = syncSettlementQueue(args.snapshot);
  const queuedSettlements = nextSnapshot.settlements
    .filter((settlement) => settlement.status === "queued")
    .filter((settlement) =>
      args.onlyKinds ? args.onlyKinds.includes(settlement.kind) : true,
    );
  let processedJobs = 0;
  let halfOpenDiscretionaryActions = 0;

  for (const settlement of queuedSettlements) {
    if (processedJobs >= args.maxJobs) {
      break;
    }

    const circuitBreakerState = getCircuitBreakerState(nextSnapshot);
    if (
      !canExecuteSettlementUnderCircuitBreaker({
        circuitBreakerState,
        kind: settlement.kind,
        halfOpenDiscretionaryActions,
      })
    ) {
      continue;
    }

    const discretionarySettlement = isDiscretionarySettlementKind(settlement.kind);
    if (discretionarySettlement && circuitBreakerState.status === "half_open") {
      halfOpenDiscretionaryActions += 1;
    }

    nextSnapshot = {
      ...nextSnapshot,
      settlements: replaceSettlements(nextSnapshot.settlements, settlement.id, (current) => ({
        ...current,
        attempts: current.attempts + 1,
        status: "running",
        updatedAt: nowIso(),
      })),
    };
    setAutonomousSnapshot(nextSnapshot);

    try {
      nextSnapshot = await executeSettlement(
        nextSnapshot,
        nextSnapshot.settlements.find((item) => item.id === settlement.id)!,
        args.executor,
      );
      if (discretionarySettlement) {
        nextSnapshot = recordCircuitBreakerSuccess(nextSnapshot);
      }
      emitAutonomousFeedEvent(
        createEvent(
          settlementEventKind(settlement.kind),
          "Settlement executed",
          nextSnapshot.latestPolicyDecision,
          [`settlementId=${settlement.id}`, `kind=${settlement.kind}`],
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Autonomous settlement failed.";
      nextSnapshot = {
        ...nextSnapshot,
        latestPolicyDecision: message,
        settlements: replaceSettlements(nextSnapshot.settlements, settlement.id, (current) => ({
          ...current,
          lastError: message,
          lastOutcome: message,
          status: "failed",
          updatedAt: nowIso(),
        })),
      };
      if (discretionarySettlement) {
        nextSnapshot = recordCircuitBreakerFailure(nextSnapshot, message);
      }
      emitAutonomousFeedEvent(
        createEvent(
          "decision",
          "Settlement failed",
          message,
          [`settlementId=${settlement.id}`, `kind=${settlement.kind}`],
        ),
      );
    }

    nextSnapshot = {
      ...nextSnapshot,
      settlements: trimTail(nextSnapshot.settlements, MAX_SETTLEMENT_HISTORY),
      tradeDirectives: trimTail(nextSnapshot.tradeDirectives, MAX_TRADE_DIRECTIVES),
    };
    setAutonomousSnapshot(nextSnapshot);
    processedJobs += 1;
  }

  return nextSnapshot;
}

function createReplicaChild(
  label: string,
  lastOutcome = "Replica bootstrapped from the parent runtime.",
) {
  const timestamp = nowIso();
  return {
    constitutionHash: readConstitutionHash(),
    constitutionPath: getConstitutionAbsolutePath(),
    createdAt: timestamp,
    heartbeatAt: timestamp,
    id: randomUUID(),
    label,
    lastOutcome,
    parentAgentId: GOONCLAW_AGENT_ID,
    runtimePhase: "booting" as const,
    scope: getReplicaExecutionScope(),
  };
}

function buildReplicaLabel(
  snapshot: AutonomousSnapshot,
  explicitLabel?: string | null,
) {
  const directLabel = explicitLabel?.trim();
  if (directLabel) {
    return directLabel;
  }

  const templateLabel =
    snapshot.selfModification.currentTuning.replicationTemplateLabel?.trim();
  const nextIndex = snapshot.replication.children.length + 1;

  return templateLabel ? `${templateLabel} ${nextIndex}` : `Replica ${nextIndex}`;
}

function appendReplicaChild(args: {
  childOutcome: string;
  label?: string | null;
  latestPolicyDecision: string;
  replicationOutcome: string;
  snapshot: AutonomousSnapshot;
}) {
  const timestamp = nowIso();
  const label = buildReplicaLabel(args.snapshot, args.label);
  const child = createReplicaChild(label, args.childOutcome);

  return {
    ...args.snapshot,
    latestPolicyDecision: args.latestPolicyDecision,
    replication: {
      ...args.snapshot.replication,
      childCount: args.snapshot.replication.children.length + 1,
      children: [...args.snapshot.replication.children, child],
      enabled: true,
      lastEventAt: timestamp,
      lastOutcome: args.replicationOutcome,
    },
  };
}

function spawnAutonomousReplica(snapshot: AutonomousSnapshot, reason: string) {
  if (!snapshot.replication.enabled) {
    return snapshot;
  }

  const nextSnapshot = appendReplicaChild({
    childOutcome: `Replica bootstrapped autonomously during heartbeat: ${reason}.`,
    latestPolicyDecision: `Autonomous replication spawned ${buildReplicaLabel(
      snapshot,
    )} during ${reason}.`,
    replicationOutcome: `Autonomous replication spawned ${buildReplicaLabel(
      snapshot,
    )}.`,
    snapshot,
  });
  nextSnapshot.latestPolicyDecision = snapshot.latestPolicyDecision;
  const newestChild = nextSnapshot.replication.children.at(-1);

  if (newestChild) {
    emitAutonomousFeedEvent(
      createEvent(
        "replication",
        "Replica child spawned",
        `Autonomous replication created ${newestChild.label}.`,
        [
          `reason=${reason}`,
          `child=${newestChild.label}`,
          `scope=${newestChild.scope}`,
        ],
      ),
    );
  }

  return nextSnapshot;
}

function resolveHealthyRuntimePhase(snapshot: AutonomousSnapshot) {
  if (snapshot.control.paused) {
    return "paused" as const;
  }

  const reserveHealthy =
    snapshot.reserveSol >= Number(getServerEnv().GOONCLAW_AGENT_RESERVE_FLOOR_SOL);
  return reserveHealthy ? ("sleeping" as const) : ("degraded" as const);
}

function propagateReplicationHeartbeat(
  snapshot: AutonomousSnapshot,
  reason: string,
) {
  if (!snapshot.replication.enabled || snapshot.replication.children.length === 0) {
    return snapshot;
  }

  const timestamp = nowIso();
  const childPhase: AutonomousSnapshot["runtimePhase"] = snapshot.control.paused
    ? "paused"
    : snapshot.runtimePhase === "degraded"
      ? "degraded"
      : "awake";

  return {
    ...snapshot,
    replication: {
      ...snapshot.replication,
      childCount: snapshot.replication.children.length,
      children: snapshot.replication.children.map((child) => ({
        ...child,
        heartbeatAt: timestamp,
        lastOutcome: `Replica heartbeat propagated from parent: ${reason}.`,
        runtimePhase: childPhase,
      })),
      lastEventAt: timestamp,
      lastOutcome: `Heartbeat propagated to ${snapshot.replication.children.length} replica runtime(s).`,
    },
  };
}

async function refreshMarketIntelSnapshot(
  snapshot: AutonomousSnapshot,
  reason: string,
) {
  try {
    const preservePrimaryDecision = snapshot.runtimePhase === "degraded";
    const intel = await withTimeout(
      buildAutonomousMarketIntel(reason, snapshot.marketIntel),
      AUTONOMOUS_MARKET_INTEL_TIMEOUT_MS,
      "Market intelligence refresh",
    );
    let nextSnapshot: AutonomousSnapshot = {
      ...snapshot,
      latestPolicyDecision: preservePrimaryDecision
        ? snapshot.latestPolicyDecision
        : intel.lastOutcome || snapshot.latestPolicyDecision,
      marketIntel: {
        ...intel,
        lastPostedAt: snapshot.marketIntel.lastPostedAt ?? null,
        lastPostedTradeCardKey: snapshot.marketIntel.lastPostedTradeCardKey ?? null,
      },
    };

    const topCard = intel.tradeCards[0] ?? null;
    const topKey = getTopTradeCardKey(intel);
    if (topCard) {
      emitAutonomousFeedEvent(
        createEvent("market", "Market heartbeat refreshed", summarizeTradeCard(topCard), [
          `candidateMint=${topCard.mint}`,
          `candidateSymbol=${topCard.symbol}`,
          `signalScore=${topCard.signalScore}`,
          `reason=${reason}`,
        ]),
      );
    }

    if (
      topCard &&
      topKey &&
      topCard.signalScore >= 70 &&
      topKey !== snapshot.marketIntel.lastPostedTradeCardKey
    ) {
      const postedDecision = preservePrimaryDecision
        ? snapshot.latestPolicyDecision
        : `Posted ${topCard.symbol} market card to BitClaw.`;
      const { post, snapshot: postedSnapshot } = await publishAutonomousGoonBookPost({
        snapshot: nextSnapshot,
        body: buildMarketCardPostBody(topCard),
        stance: topCard.stance,
        tokenSymbol: `$${topCard.symbol}`,
        tradeCard: topCard,
        latestPolicyDecision: postedDecision,
        eventTitle: "BitClaw trade card posted",
        eventDetail: `Posted ${topCard.symbol} from the live heartbeat tape.`,
        rawTrace: [
          `candidateMint=${topCard.mint}`,
          `candidateSymbol=${topCard.symbol}`,
          `signalScore=${topCard.signalScore}`,
          `reason=${reason}`,
        ],
      });

      nextSnapshot = {
        ...postedSnapshot,
        marketIntel: {
          ...postedSnapshot.marketIntel,
          lastOutcome: `Heartbeat posted ${topCard.symbol} to BitClaw.`,
          lastPostedAt: post.createdAt,
          lastPostedTradeCardKey: topKey,
        },
      };
    }

    return nextSnapshot;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Market intelligence refresh failed.";
    emitAutonomousFeedEvent(
      createEvent("market", "Market heartbeat degraded", message, [`reason=${reason}`]),
    );
    return {
      ...snapshot,
      marketIntel: {
        ...snapshot.marketIntel,
        heartbeatSource: reason,
        lastOutcome: message,
      },
    };
  }
}

export async function performAutonomousControl(
  action: AutonomousControlAction,
  note?: string,
  options?: ControlOptions,
) {
  const executor = options?.executor || createDefaultAutonomousSettlementExecutor();
  const snapshot = getAutonomousSnapshot();
  const timestamp = nowIso();
  let nextSnapshot: AutonomousSnapshot = {
    ...snapshot,
    control: {
      ...snapshot.control,
      lastAction: action,
      lastActionAt: timestamp,
    },
  };

  if (action === "pause") {
    nextSnapshot = {
      ...nextSnapshot,
      latestPolicyDecision: "Owner paused autonomous runtime.",
      runtimePhase: "paused",
      wakeReason: "paused by owner",
      control: {
        ...nextSnapshot.control,
        pauseReason: note || "Paused from hidden admin dashboard.",
        paused: true,
      },
    };
    setAutonomousSnapshot(nextSnapshot);
  }

  if (action === "resume") {
    nextSnapshot = {
      ...nextSnapshot,
      latestPolicyDecision: "Owner resumed autonomous runtime.",
      runtimePhase: "awake",
      wakeReason: "manual resume",
      control: {
        ...nextSnapshot.control,
        pauseReason: null,
        paused: false,
      },
    };
    setAutonomousSnapshot(nextSnapshot);
  }

  if (action === "wake") {
    nextSnapshot = {
      ...nextSnapshot,
      latestPolicyDecision: "Owner triggered an immediate heartbeat cycle.",
      runtimePhase: "awake",
      wakeReason: note || "manual wake",
    };
    setAutonomousSnapshot(nextSnapshot);
    nextSnapshot = await tickAutonomousHeartbeat(
      note || "manual wake from hidden admin dashboard",
      { executor },
    );
  }

  if (action === "force_settle") {
    nextSnapshot = queueLiquidationJobs({
      ...nextSnapshot,
      latestPolicyDecision: "Owner forced immediate settlement and liquidation.",
      runtimePhase: "settling",
    });
    setAutonomousSnapshot(nextSnapshot);
    nextSnapshot = await processSettlementQueue({
      executor,
      maxJobs: Math.max(1, nextSnapshot.settlements.length),
      snapshot: nextSnapshot,
    });
    nextSnapshot = {
      ...nextSnapshot,
      runtimePhase: resolveHealthyRuntimePhase(nextSnapshot),
    };
    setAutonomousSnapshot(nextSnapshot);
  }

  if (action === "force_liquidate") {
    nextSnapshot = queueLiquidationJobs({
      ...nextSnapshot,
      latestPolicyDecision: "Owner forced treasury liquidation.",
      runtimePhase: "liquidating",
    });
    setAutonomousSnapshot(nextSnapshot);
    nextSnapshot = await processSettlementQueue({
      executor,
      maxJobs: Math.max(1, nextSnapshot.settlements.length),
      onlyKinds: ["position_liquidation"],
      snapshot: nextSnapshot,
    });
    nextSnapshot = {
      ...nextSnapshot,
      runtimePhase: resolveHealthyRuntimePhase(nextSnapshot),
    };
    setAutonomousSnapshot(nextSnapshot);
  }

  if (action === "approve_self_mod") {
    nextSnapshot = applyPendingSelfModification(nextSnapshot, note);
    setAutonomousSnapshot(nextSnapshot);
  }

  if (action === "reject_self_mod") {
    nextSnapshot = rejectPendingSelfModification(nextSnapshot, note);
    setAutonomousSnapshot(nextSnapshot);
  }

  if (action === "trigger_replication") {
    const label = buildReplicaLabel(nextSnapshot, note);
    nextSnapshot = appendReplicaChild({
      childOutcome: `Replica bootstrapped from owner control: ${label}.`,
      label,
      latestPolicyDecision: `Owner triggered replica child runtime: ${label}.`,
      replicationOutcome: `Replica child runtime created: ${label}.`,
      snapshot: nextSnapshot,
    });
    setAutonomousSnapshot(nextSnapshot);
  }

  if (action === "halt_replication") {
    nextSnapshot = {
      ...nextSnapshot,
      latestPolicyDecision: "Owner halted replication activity.",
      replication: {
        ...nextSnapshot.replication,
        children: nextSnapshot.replication.children.map((child) => ({
          ...child,
          lastOutcome: note || "Owner halted this replica runtime.",
          runtimePhase: "paused",
        })),
        enabled: false,
        lastEventAt: timestamp,
        lastOutcome: note || "Owner halted replication until further notice.",
      },
    };
    setAutonomousSnapshot(nextSnapshot);
  }

  emitAutonomousFeedEvent(
    createEvent(
      action === "approve_self_mod" || action === "reject_self_mod"
        ? "self_mod"
        : action === "trigger_replication" || action === "halt_replication"
          ? "replication"
          : "control",
      `Owner control: ${action}`,
      note || `Hidden admin invoked ${action}.`,
      [`action=${action}`, `note=${note || "n/a"}`],
    ),
  );

  return nextSnapshot;
}

export async function tickAutonomousHeartbeat(
  reason = "scheduled heartbeat",
  options?: ControlOptions,
) {
  const env = getServerEnv();
  const executor = options?.executor || createDefaultAutonomousSettlementExecutor();
  const snapshot = getAutonomousSnapshot();
  const timestamp = nowIso();
  const nowMs = Date.now();

  if (snapshot.control.paused) {
    emitAutonomousFeedEvent(
      createEvent(
        "heartbeat",
        "Heartbeat skipped",
        "Runtime is paused, heartbeat recorded without execution.",
        [`paused=true`, `reason=${snapshot.control.pauseReason || "owner"}`],
      ),
    );
    return snapshot;
  }

  const reserveHealthy =
    snapshot.reserveSol >= Number(env.GOONCLAW_AGENT_RESERVE_FLOOR_SOL);
  const initialDecision = reserveHealthy
    ? "Reserve floor healthy; continue autonomous settlement and replication work."
    : "Reserve floor breach detected; discretionary trading remains blocked until reserve recovers.";
  const refreshedCircuitBreakerState = evaluateCircuitBreaker({
    state: getCircuitBreakerState(snapshot),
    nowMs,
    consecutiveFailures: getCircuitBreakerState(snapshot).consecutiveFailures,
  });

  let nextSnapshot: AutonomousSnapshot = applyCircuitBreakerState({
    snapshot: {
    ...snapshot,
    heartbeatAt: timestamp,
    latestPolicyDecision: initialDecision,
    runtimePhase: reserveHealthy ? ("awake" as const) : ("degraded" as const),
    wakeReason: reason,
    },
    circuitBreakerState: refreshedCircuitBreakerState,
    reason: initialDecision,
  });

  setAutonomousSnapshot(nextSnapshot);
  emitAutonomousFeedEvent(
    createEvent("heartbeat", "Autonomous heartbeat", initialDecision, [
      `phase=${nextSnapshot.runtimePhase}`,
      `reserveSol=${snapshot.reserveSol.toFixed(6)}`,
      `reserveFloor=${env.GOONCLAW_AGENT_RESERVE_FLOOR_SOL}`,
      `reason=${reason}`,
    ]),
  );

  nextSnapshot = await refreshMarketIntelSnapshot(nextSnapshot, reason);
  setAutonomousSnapshot(nextSnapshot);

  nextSnapshot = spawnAutonomousReplica(nextSnapshot, reason);
  setAutonomousSnapshot(nextSnapshot);

  nextSnapshot = propagateReplicationHeartbeat(nextSnapshot, reason);
  setAutonomousSnapshot(nextSnapshot);

  nextSnapshot = await processSettlementQueue({
    executor,
    maxJobs: reserveHealthy ? 8 : 4,
    onlyKinds: reserveHealthy ? undefined : ["reserve_rebalance", "position_liquidation"],
    snapshot: nextSnapshot,
  });

  nextSnapshot = {
    ...nextSnapshot,
    runtimePhase: resolveHealthyRuntimePhase(nextSnapshot),
  };
  setAutonomousSnapshot(nextSnapshot);

  return nextSnapshot;
}

export function getAutonomousStatus() {
  const env = getServerEnv();
  const snapshot = getAutonomousSnapshot();
  const modelRuntime = getAgentModelStatus();
  const solanaRuntime = getSolanaAgentRuntimeStatus();
  const recentFeed = listAutonomousFeedEvents(20);
  const vendoredSkillNames = getVendoredGoonclawSkillNames(
    path.resolve(process.cwd(), env.GOONCLAW_SKILLS_DIR),
  );
  const codexSkillNames = getInstalledLocalCodexSkillNames();
  const configuredMcpServerNames = getConfiguredRepoMcpServerNames();
  const skillCount = vendoredSkillNames.length;
  const dexterX402 = getDexterX402Status();
  const gmgn = getGmgnStatus();
  const constitutionPath = getConstitutionAbsolutePath();
  const constitutionHash = readConstitutionHash();
  const reserveFloorSol = Number(env.GOONCLAW_AGENT_RESERVE_FLOOR_SOL);
  const transferGuardrails = getAutonomousTransferGuardrails();
  const tradeGuardrails = getAutonomousTradeGuardrails();
  const circuitBreakerState = getCircuitBreakerState(snapshot);

  return {
    agentId: GOONCLAW_AGENT_ID,
    constitutionHash,
    constitutionPath,
    control: {
      ...snapshot.control,
      circuitBreakerState,
    },
    circuitBreakerState,
    feedSize: listAutonomousFeedEvents().length,
    goals: [
      "Maximize sustainable profit inside the human-agent business partnership.",
      `Protect the ${env.GOONCLAW_AGENT_RESERVE_FLOOR_SOL} SOL reserve floor before discretionary actions.`,
      "Route enforced buyback-and-burn settlements into the GoonClaw token.",
      "Keep heartbeat, decisions, and tool traces public while private controls stay owner-only.",
      "Trade only Pump meme coins through the configured GMGN Solana route and cap any single meme coin position at 10% of the tracked portfolio value.",
      "Refresh market tape, smart-wallet dossiers, top X-linked snippets, and llms.txt-compatible domain docs on every heartbeat before selecting runtime candidates.",
      "Allow audited self-mod proposals to tune runtime behavior without granting arbitrary code execution.",
      "Autonomously spawn uncapped replica child runtimes inside the same constitutional envelope.",
      "Prefer Google Cloud execution first; use Conway domains only when needed and Conway Codex services only as fallback.",
    ],
    heartbeatAt: snapshot.heartbeatAt,
    latestPolicyDecision: snapshot.latestPolicyDecision,
    modelRuntime,
    name: "GoonClaw",
    positions: snapshot.positions,
    publicTraceMode: env.GOONCLAW_PUBLIC_TRACE_MODE,
    purpose: GOONCLAW_PURPOSE,
    recentFeed,
    marketIntel: snapshot.marketIntel,
    replication: snapshot.replication,
    revenueBuckets: snapshot.revenueBuckets,
    revenuePolicies: getRevenuePolicies(),
    runtimePhase: snapshot.runtimePhase,
    selfModification: snapshot.selfModification,
    settlements: snapshot.settlements.slice().reverse().slice(0, 20),
    tooling: {
      agentWalletAddress: solanaRuntime.walletAddress,
      availableActions: solanaRuntime.actionNames,
      blockedActionNames: solanaRuntime.blockedActionNames,
      codexSkillNames,
      configuredMcpServerNames,
      conwayApiKeyConfigured: Boolean(env.CONWAY_API_KEY.trim()),
      conwayCodexMcpConfigured: hasConwayCodexMcpBridgeConfig(),
      context7McpConfigured:
        hasContext7McpBridgeConfig() ||
        configuredMcpServerNames.includes("context7"),
      dexterX402Installed: dexterX402.installed,
      dexterX402Version: dexterX402.version,
      excelMcpConfigured:
        hasExcelMcpBridgeConfig() || configuredMcpServerNames.includes("excel"),
      gmgnConfigured: gmgn.configured,
      gmgnSigningReady: gmgn.signingReady,
      gmgnTradingWallet: gmgn.tradingWallet,
      loadedActionCount: solanaRuntime.actionNames.length,
      loadedSkillCount: skillCount,
      solanaAgentKitConfigured: solanaRuntime.configured,
      solanaMcpConfigured: hasSolanaMcpBridgeConfig(),
      taskMasterMcpConfigured:
        hasTaskMasterMcpBridgeConfig() ||
        configuredMcpServerNames.includes("taskmaster"),
      tavilyApiKeyConfigured: Boolean(env.TAVILY_API_KEY.trim()),
      tavilyMcpConfigured:
        hasTavilyMcpBridgeConfig() || configuredMcpServerNames.includes("tavily"),
      telegramBroadcastEnabled: isGoonclawTelegramBroadcastEnabled(),
      telegramChatConfigured: Boolean(env.GOONCLAW_TELEGRAM_CHAT_ID),
      vendoredSkillNames,
      vertexOnly:
        env.AGENT_MODEL_PROVIDER === "vertex-ai-gemini" &&
        env.GOOGLE_GENAI_USE_VERTEXAI === "true",
    },
    tradeDirectives: snapshot.tradeDirectives.slice().reverse().slice(0, 20),
    treasury: {
      goonclawTokenMint: env.BAGSTROKE_TOKEN_MINT,
      ownerWallet: env.GOONCLAW_OWNER_WALLET,
      reserveFloorSol,
      reserveHealthy: snapshot.reserveSol >= reserveFloorSol,
      reserveSol: snapshot.reserveSol,
      transferGuardrails,
      tradeGuardrails,
      treasuryWallet: env.TREASURY_WALLET,
      usdcBalance: snapshot.usdcBalance,
    },
    wakeReason: snapshot.wakeReason,
  } satisfies AutonomousAgentStatus;
}

export async function getAutonomousStatusWithLiveReserve() {
  const status = getAutonomousStatus();
  const liveReserveSol = await getWalletSolBalance(status.treasury.treasuryWallet);

  if (liveReserveSol === null || !Number.isFinite(liveReserveSol)) {
    return status;
  }

  return {
    ...status,
    treasury: {
      ...status.treasury,
      reserveHealthy: liveReserveSol >= status.treasury.reserveFloorSol,
      reserveSol: liveReserveSol,
    },
  } satisfies AutonomousAgentStatus;
}

export function getAutonomousFeed(limit = 80) {
  return listAutonomousFeedEvents(limit);
}

export function getAutonomousRuntimeSummary(): AutonomousRuntimeSummary {
  const status = getAutonomousStatus();
  return {
    heartbeatAt: status.heartbeatAt,
    lastAction: status.control.lastAction,
    lastActionAt: status.control.lastActionAt,
    latestPolicyDecision: status.latestPolicyDecision,
    pauseReason: status.control.pauseReason,
    paused: status.control.paused,
    pendingSelfModification: status.selfModification.pendingProposal || null,
    queuedSettlements: status.settlements.filter(
      (settlement) => settlement.status === "queued",
    ).length,
    queuedTradeDirectives: status.tradeDirectives.filter(
      (directive) => directive.status === "queued",
    ).length,
    replicationChildCount: status.replication.childCount,
    replicationEnabled: status.replication.enabled,
    reserveFloorSol: status.treasury.reserveFloorSol,
    reserveHealthy: status.treasury.reserveHealthy,
    reserveSol: status.treasury.reserveSol,
    runtimePhase: status.runtimePhase,
  };
}
