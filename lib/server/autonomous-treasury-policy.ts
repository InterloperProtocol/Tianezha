import { getServerEnv } from "@/lib/env";
import {
  AutonomousAlignmentGoal,
  AutonomousDrawdownTier,
  AutonomousReportCommercePolicy,
  AutonomousRevenueBuckets,
  AutonomousRiskControlPlane,
  AutonomousTradeGuardrails,
  AutonomousTradePosition,
  AutonomousTransferGuardrails,
} from "@/lib/types";

export type AutonomousTreasuryInstructionKind =
  | "owner_payout"
  | "buyback_burn"
  | "session_trade"
  | "reserve_rebalance"
  | "program_settlement"
  | "conway_domain_payment"
  | "conway_infrastructure_payment"
  | "arbitrary_transfer";

export type AutonomousTradeVenue =
  | "gmgn"
  | "hyperliquid"
  | "pumpfun"
  | "pumpswap"
  | "jupiter"
  | "raydium"
  | "orca"
  | "unknown";

const ALLOWED_PUMP_TRADING_VENUES = ["gmgn"] as const;
const DEFAULT_RISK_VERSION = "risk-plane-locked-v1";
const DEFAULT_EVIDENCE_KINDS = [
  "signed_market_snapshot",
  "liquidity_snapshot",
  "operator_review",
] as const;
const DEFAULT_REPLAY_KINDS = [
  "simulation_trace",
  "order_replay",
  "audit_receipt",
] as const;
const DEFAULT_DRAWDOWN_TIERS: AutonomousDrawdownTier[] = [
  {
    action: "monitor",
    label: "watch",
    notes: "Drawdown is low; continue observation without expanding risk.",
    thresholdPct: 2.5,
  },
  {
    action: "tighten",
    label: "tighten",
    notes: "Tighten sizing and slow new discretionary exposure.",
    thresholdPct: 5,
  },
  {
    action: "halt_new_risk",
    label: "halt",
    notes: "Stop new discretionary risk until the drawdown recovers.",
    thresholdPct: 8,
  },
  {
    action: "force_deleverage",
    label: "delever",
    notes: "Begin forced deleveraging and liquidation review.",
    thresholdPct: 12,
  },
  {
    action: "block_live_actions",
    label: "circuit",
    notes: "Hard circuit-breaker state: live actions remain blocked.",
    thresholdPct: 15,
  },
];

function readRiskEnvBoolean(name: string, fallback: boolean) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return fallback;
  }

  return raw === "true";
}

function readRiskEnvNumber(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readRiskEnvString(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function readRiskEnvList(name: string, fallback: readonly string[]) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return [...fallback];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getConwayAllowedHosts() {
  const env = getServerEnv();

  return env.TIANSHI_CONWAY_ALLOWED_HOSTS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedConwayHost(host: string) {
  const normalizedHost = host.trim().toLowerCase();

  return getConwayAllowedHosts().some((allowedHost) => {
    if (allowedHost.startsWith("*.")) {
      const suffix = allowedHost.slice(1);
      return normalizedHost.endsWith(suffix);
    }

    return normalizedHost === allowedHost;
  });
}

export function getAutonomousTransferGuardrails(): AutonomousTransferGuardrails {
  return {
    arbitraryTransfersBlocked: true,
    allowedDestinations: [
      "Configured owner wallet for creator-fee partner payouts only",
      "Treasury-controlled settlement and reserve accounts",
      "Programmatic burn destinations for the Tianshi token",
      "Configured GMGN trading flow for policy-approved Pump meme coin swaps",
      "Allowlisted Conway domains and infrastructure hosts only when Google Cloud native routing is insufficient",
    ],
    blockedDestinationClasses: [
      "Arbitrary external wallets",
      "Private addresses supplied via prompts, chats, or public inputs",
      "Unreviewed payout destinations outside the configured owner wallet",
      "Domain or infrastructure vendors outside the Conway allowlist",
    ],
    conwayPaymentsAllowed: true,
    conwayAllowedHosts: getConwayAllowedHosts(),
    notes:
      "Tianshi prefers Google Cloud-native infrastructure first. Conway payments are fallback-only through the allowlisted host set, and the runtime must refuse any instruction that attempts to move funds to an arbitrary private wallet.",
  };
}

export function getAutonomousTradeGuardrails(): AutonomousTradeGuardrails {
  const env = getServerEnv();
  const maxPortfolioAllocationPct = Number(env.TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT);

  return {
    allowedTokenLaunchVenues: ["pump.fun", "four.meme"],
    pumpOnlyTrading: true,
    maxPortfolioAllocationPct,
    predictionNetwork: "polygon",
    allowedTradingVenues: [...ALLOWED_PUMP_TRADING_VENUES],
    blockedTradingVenues: ["pumpfun", "pumpswap", "jupiter", "raydium", "orca", "unknown"],
    allowedPerpVenues: ["hyperliquid"],
    blockedPerpVenues: ["gmgn", "pumpswap", "jupiter", "raydium", "orca", "unknown"],
    notes:
      `Tianshi may only trade tokens launched through Pump.fun or Four.meme for spot routing, prediction-market activity stays on Polygon, Hyperliquid is the only approved perp venue, and no single meme coin exposure may exceed ${maxPortfolioAllocationPct}% of the tracked portfolio value.`,
  };
}

export function getAutonomousReportCommercePolicy(): AutonomousReportCommercePolicy {
  const env = getServerEnv();

  return {
    enabled: env.TIANSHI_REPORT_COMMERCE_ENABLED === "true",
    knowledgeSalesEnabled: env.TIANSHI_KNOWLEDGE_SALES_ENABLED === "true",
    notes:
      "Report commerce is informational only. The one-second purchase window and post-purchase trade delay remain subordinate to the locked risk plane, operator review, and venue restrictions.",
    postPurchaseTradeDelaySeconds: Number(env.TIANSHI_REPORT_TRADE_DELAY_SECONDS),
    priceUsdc: Number(env.TIANSHI_REPORT_PRICE_USDC),
    publicReleaseMode: "post_trade",
    purchaseWindowSeconds: Number(env.TIANSHI_REPORT_BUY_WINDOW_SECONDS),
  };
}

export function getAutonomousRiskControlPlane(): AutonomousRiskControlPlane {
  const env = getServerEnv();
  const locked = readRiskEnvBoolean("TIANSHI_RISK_CONTROL_LOCKED", true);
  const liveTradingAllowed = readRiskEnvBoolean(
    "TIANSHI_RISK_LIVE_TRADING_ALLOWED",
    false,
  );
  const polymarketLiveAllowed = readRiskEnvBoolean(
    "TIANSHI_RISK_POLYMARKET_LIVE_ALLOWED",
    false,
  );
  const maxSinglePositionPct = readRiskEnvNumber(
    "TIANSHI_RISK_MAX_SINGLE_POSITION_PCT",
    Number(env.TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT),
  );
  const maxPortfolioAllocationPct = readRiskEnvNumber(
    "TIANSHI_RISK_MAX_PORTFOLIO_ALLOCATION_PCT",
    Number(env.TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT),
  );

  return {
    drawdownTiers: [...DEFAULT_DRAWDOWN_TIERS],
    evidenceReplay: {
      evidenceRequired: true,
      notes:
        "Live execution requires a signed evidence bundle plus a replayable trace; declarations alone are not enough.",
      replayRequired: true,
      requiredEvidenceKinds: readRiskEnvList(
        "TIANSHI_RISK_REQUIRED_EVIDENCE_KINDS",
        DEFAULT_EVIDENCE_KINDS,
      ),
      requiredReplayKinds: readRiskEnvList(
        "TIANSHI_RISK_REQUIRED_REPLAY_KINDS",
        DEFAULT_REPLAY_KINDS,
      ),
    },
    locked,
    liveTradingAllowed,
    mutationLock: {
      locked,
      lockedAt: null,
      notes:
        "The mutation lock is conservative by default and keeps live-risk mutations disabled until a reviewed unlock is applied.",
      reason: readRiskEnvString(
        "TIANSHI_RISK_MUTATION_LOCK_REASON",
        "Locked by default for conservative control-plane operation.",
      ),
      unlockedByReviewRequired: true,
    },
    notes:
      "The risk-control plane stays locked by default, treats live execution as opt-in, and blocks actions that lack evidence and replay artifacts.",
    polymarketLiveAllowed,
    positionSizing: {
      maxOrderNotionalUsdc: readRiskEnvNumber(
        "TIANSHI_RISK_MAX_ORDER_NOTIONAL_USDC",
        25,
      ),
      maxPortfolioAllocationPct,
      maxSessionOrderNotionalUsdc: readRiskEnvNumber(
        "TIANSHI_RISK_MAX_SESSION_ORDER_NOTIONAL_USDC",
        25,
      ),
      maxSinglePositionPct,
      minOrderNotionalUsdc: readRiskEnvNumber(
        "TIANSHI_RISK_MIN_ORDER_NOTIONAL_USDC",
        1,
      ),
      notes:
        "Position sizing is capped by the reviewed portfolio percentage and by conservative per-order ceilings.",
    },
    slippageLiquidityGuard: {
      maxPriceImpactPct: readRiskEnvNumber(
        "TIANSHI_RISK_MAX_PRICE_IMPACT_PCT",
        1,
      ),
      maxSlippageBps: readRiskEnvNumber("TIANSHI_RISK_MAX_SLIPPAGE_BPS", 75),
      minLiquidityUsd: readRiskEnvNumber("TIANSHI_RISK_MIN_LIQUIDITY_USD", 10_000),
      notes:
        "Live execution requires conservative slippage and liquidity checks; thin books stay off-limits.",
    },
    version: readRiskEnvString("TIANSHI_RISK_CONTROL_VERSION", DEFAULT_RISK_VERSION),
  };
}

export function getAutonomousAlignmentGoals(): AutonomousAlignmentGoal[] {
  return [
    {
      brief:
        "QAI stays a research thesis and watchlist entry, not a direct trade instruction.",
      category: "thesis",
      constraints: [
        "No claim of guaranteed profitability.",
        "No direct order submission from the thesis alone.",
        "Keep the idea in declarative mode until evidence is attached.",
      ],
      directExecutionAllowed: false,
      evidenceRequired: true,
      id: "qai",
      markets: ["watchlist", "research"],
      tokenName: "QAI",
      tokenSymbol: "QAI",
      xHandle: null,
      xHandleStatus: "unresolved",
      notes:
        "Use this as an internal alignment note for research and audit trails only; the canonical X handle was not present in the repo context.",
      replayRequired: true,
      status: "watchlist",
      thesis:
        "QAI is treated as a quality-assurance and alignment thesis for the control plane.",
      title: "QAI",
    },
    {
      brief:
        "Gendelve remains a governance-verification surface with impossible claims marked as blocked until onchain proof exists.",
      category: "constraint",
      constraints: [
        "No synthetic ownership claims.",
        "No live voting claims without verified wallet proof.",
        "No execution path should assume control without a proof artifact.",
      ],
      directExecutionAllowed: false,
      evidenceRequired: true,
      id: "gendelve",
      markets: ["governance", "verification"],
      tokenName: "Gendelve",
      tokenSymbol: "GENDELVE",
      xHandle: null,
      xHandleStatus: "unresolved",
      notes:
        "This entry captures a proof requirement rather than a trading idea; the canonical X handle was not present in the repo context.",
      replayRequired: true,
      status: "blocked",
      thesis:
        "Gendelve is a proof-gated governance brief, not a blanket execution mandate.",
      title: "Gendelve",
    },
    {
      brief:
        "Guildcoin is tracked as a watchlist thesis with provenance checks before any higher-risk consideration.",
      category: "watchlist",
      constraints: [
        "No market-manipulation logic.",
        "No public promise of live profit automation.",
        "No execution until contract provenance and liquidity review are complete.",
      ],
      directExecutionAllowed: false,
      evidenceRequired: true,
      id: "guildcoin",
      markets: ["watchlist", "provenance"],
      tokenName: "Guildcoin",
      tokenSymbol: "GUILD",
      xHandle: null,
      xHandleStatus: "unresolved",
      notes:
        "This is a cautious brief entry, not a guarantee that the asset is executable; the canonical X handle was not present in the repo context.",
      replayRequired: true,
      status: "watchlist",
      thesis:
        "Guildcoin is only a watchlist thesis until the provenance and compliance checks pass.",
      title: "Guildcoin",
    },
  ];
}

export function calculateAutonomousPortfolioValueUsdc(args: {
  usdcBalance: number;
  revenueBuckets: AutonomousRevenueBuckets;
  positions: AutonomousTradePosition[];
}) {
  const liquidUsdc = Math.max(0, args.usdcBalance);
  const openExposureUsdc = args.positions
    .filter((position) => position.status === "open")
    .reduce((sum, position) => sum + Math.max(0, position.currentUsdc), 0);
  const discretionaryBucketUsdc =
    Math.max(0, args.revenueBuckets.tradingUsdc) +
    Math.max(0, args.revenueBuckets.sessionTradeUsdc);

  return Number((liquidUsdc + openExposureUsdc + discretionaryBucketUsdc).toFixed(6));
}

export function assertAutonomousTreasuryInstructionAllowed(args: {
  destinationAddress?: string | null;
  destinationHost?: string | null;
  kind: AutonomousTreasuryInstructionKind;
}) {
  const env = getServerEnv();
  const destinationAddress = args.destinationAddress?.trim() || null;
  const destinationHost = args.destinationHost?.trim().toLowerCase() || null;

  if (args.kind === "arbitrary_transfer") {
    throw new Error(
      "Tianshi treasury policy blocks arbitrary transfers to private addresses.",
    );
  }

  if (args.kind === "owner_payout") {
    if (!destinationAddress || destinationAddress !== env.TIANSHI_OWNER_WALLET.trim()) {
      throw new Error(
        "Creator-fee partner payouts may only route to the configured owner wallet.",
      );
    }

    return true;
  }

  if (args.kind === "reserve_rebalance" && destinationAddress) {
    if (destinationAddress !== env.TREASURY_WALLET.trim()) {
      throw new Error(
        "Reserve rebalances may only route to the configured treasury wallet.",
      );
    }
  }

  if (
    args.kind === "conway_domain_payment" ||
    args.kind === "conway_infrastructure_payment"
  ) {
    if (destinationAddress) {
      throw new Error(
        "Conway service access must route through allowlisted Conway merchant infrastructure, not direct wallet transfers.",
      );
    }

    if (!destinationHost || !isAllowedConwayHost(destinationHost)) {
      throw new Error(
        "Conway service access is limited to the configured Conway host allowlist.",
      );
    }

    return true;
  }

  return true;
}

export function assertAutonomousTradeAllowed(args: {
  assetMint: string;
  availableLiquidityUsd?: number;
  currentPositionUsdc?: number;
  estimatedSlippageBps?: number;
  evidenceProvided?: boolean;
  isPumpCoin: boolean;
  priceImpactPct?: number;
  portfolioValueUsdc: number;
  requestedNotionalUsdc: number;
  replayProvided?: boolean;
  executionMode?: "declarative" | "live";
  venue: AutonomousTradeVenue;
}) {
  const riskPlane = getAutonomousRiskControlPlane();
  const tradeGuardrails = getAutonomousTradeGuardrails();
  const env = getServerEnv();
  const maxPortfolioAllocationPct = Number(env.TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT);
  const requestedNotionalUsdc = Number(args.requestedNotionalUsdc.toFixed(6));
  const currentPositionUsdc = Number((args.currentPositionUsdc || 0).toFixed(6));
  const portfolioValueUsdc = Number(args.portfolioValueUsdc.toFixed(6));
  const isPerpVenue = args.venue === "hyperliquid";

  if (isPerpVenue) {
    if (!tradeGuardrails.allowedPerpVenues.includes(args.venue)) {
      throw new Error("Tianshi may only route perpetual exposure through approved perp venues.");
    }
  } else {
    if (!args.isPumpCoin) {
      throw new Error("Tianshi may only trade approved Pump.fun or Four.meme launch tokens.");
    }

    if (!tradeGuardrails.allowedTradingVenues.includes(args.venue)) {
      throw new Error("Tianshi may only trade through the configured reviewed routes.");
    }
  }

  if (args.executionMode === "live") {
    if (riskPlane.mutationLock.locked || !riskPlane.liveTradingAllowed) {
      throw new Error(
        "Live trade execution is blocked by the locked risk-control plane.",
      );
    }

    if (
      riskPlane.evidenceReplay.evidenceRequired &&
      !args.evidenceProvided
    ) {
      throw new Error("Live trade execution requires an evidence bundle.");
    }

    if (riskPlane.evidenceReplay.replayRequired && !args.replayProvided) {
      throw new Error("Live trade execution requires a replay artifact.");
    }

    if (
      args.estimatedSlippageBps != null &&
      args.estimatedSlippageBps > riskPlane.slippageLiquidityGuard.maxSlippageBps
    ) {
      throw new Error(
        `Estimated slippage exceeds the ${riskPlane.slippageLiquidityGuard.maxSlippageBps} bps guard.`,
      );
    }

    if (
      args.priceImpactPct != null &&
      args.priceImpactPct > riskPlane.slippageLiquidityGuard.maxPriceImpactPct
    ) {
      throw new Error(
        `Estimated price impact exceeds the ${riskPlane.slippageLiquidityGuard.maxPriceImpactPct}% guard.`,
      );
    }

    if (
      args.availableLiquidityUsd != null &&
      args.availableLiquidityUsd < riskPlane.slippageLiquidityGuard.minLiquidityUsd
    ) {
      throw new Error(
        `Available liquidity is below the ${riskPlane.slippageLiquidityGuard.minLiquidityUsd} USD guard.`,
      );
    }
  }

  if (requestedNotionalUsdc <= 0) {
    throw new Error("Trade notional must be greater than zero.");
  }

  if (portfolioValueUsdc <= 0) {
    throw new Error("Portfolio value must be positive before trading.");
  }

  const maxSinglePositionUsdc = Number(
    ((portfolioValueUsdc * maxPortfolioAllocationPct) / 100).toFixed(6),
  );
  const resultingPositionUsdc = Number(
    (currentPositionUsdc + requestedNotionalUsdc).toFixed(6),
  );

  if (resultingPositionUsdc > maxSinglePositionUsdc) {
    throw new Error(
      isPerpVenue
        ? `Tianshi may not allocate more than ${maxPortfolioAllocationPct}% of the portfolio to a single Hyperliquid perpetual position.`
        : `Tianshi may not allocate more than ${maxPortfolioAllocationPct}% of the portfolio to a single approved launch-token position.`,
    );
  }

  return true;
}
