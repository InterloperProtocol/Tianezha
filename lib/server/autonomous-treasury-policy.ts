import { getServerEnv } from "@/lib/env";
import {
  AutonomousRevenueBuckets,
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
  | "pumpfun"
  | "pumpswap"
  | "jupiter"
  | "raydium"
  | "orca"
  | "unknown";

const ALLOWED_PUMP_TRADING_VENUES = ["gmgn"] as const;

function getConwayAllowedHosts() {
  const env = getServerEnv();

  return env.GOONCLAW_CONWAY_ALLOWED_HOSTS.split(",")
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
      "Programmatic burn destinations for the GoonClaw token",
      "Configured GMGN trading flow for policy-approved Pump meme coin swaps",
      "Allowlisted Conway domains and infrastructure hosts for business-critical services",
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
      "GoonClaw may settle owner payouts, reserves, burns, GMGN-routed Pump trades, and allowlisted Conway service payments, but it must refuse any instruction that attempts to move funds to an arbitrary private wallet.",
  };
}

export function getAutonomousTradeGuardrails(): AutonomousTradeGuardrails {
  const env = getServerEnv();
  const maxPortfolioAllocationPct = Number(env.GOONCLAW_MEMECOIN_MAX_PORTFOLIO_PCT);

  return {
    pumpOnlyTrading: true,
    maxPortfolioAllocationPct,
    allowedTradingVenues: [...ALLOWED_PUMP_TRADING_VENUES],
    blockedTradingVenues: ["pumpfun", "pumpswap", "jupiter", "raydium", "orca", "unknown"],
    notes:
      "GoonClaw may only buy and sell Pump meme coins through the configured GMGN Solana route, and no single meme coin exposure may exceed 10% of the tracked portfolio value.",
  };
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
      "GoonClaw treasury policy blocks arbitrary transfers to private addresses.",
    );
  }

  if (args.kind === "owner_payout") {
    if (!destinationAddress || destinationAddress !== env.GOONCLAW_OWNER_WALLET.trim()) {
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
  currentPositionUsdc?: number;
  isPumpCoin: boolean;
  portfolioValueUsdc: number;
  requestedNotionalUsdc: number;
  venue: AutonomousTradeVenue;
}) {
  const env = getServerEnv();
  const maxPortfolioAllocationPct = Number(env.GOONCLAW_MEMECOIN_MAX_PORTFOLIO_PCT);
  const requestedNotionalUsdc = Number(args.requestedNotionalUsdc.toFixed(6));
  const currentPositionUsdc = Number((args.currentPositionUsdc || 0).toFixed(6));
  const portfolioValueUsdc = Number(args.portfolioValueUsdc.toFixed(6));

  if (!args.isPumpCoin) {
    throw new Error("GoonClaw may only trade Pump meme coins.");
  }

  if (
    args.venue !== "gmgn"
  ) {
    throw new Error("GoonClaw may only trade through the configured GMGN route.");
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
      `GoonClaw may not allocate more than ${maxPortfolioAllocationPct}% of the portfolio to a single meme coin position.`,
    );
  }

  return true;
}
