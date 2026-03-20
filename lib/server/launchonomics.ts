import { PublicKey } from "@solana/web3.js";

import { getServerEnv } from "@/lib/env";
import { DEFAULT_ACCESS_TOKEN_SYMBOL } from "@/lib/token-defaults";
import {
  LaunchonomicsBadge,
  LaunchonomicsEvaluation,
  LaunchonomicsTier,
  LaunchonomicsWindowSet,
} from "@/lib/types";
import { addHours, addMonths, addYears } from "@/lib/utils";

type HeliusWalletTransfer = {
  amount?: number;
  amountRaw?: string;
  counterparty?: string;
  direction?: "in" | "out";
  mint?: string;
  signature?: string;
  symbol?: string | null;
  timestamp?: number;
};

type HeliusTransfersResponse = {
  data?: HeliusWalletTransfer[];
  pagination?: {
    hasMore?: boolean;
    nextCursor?: string | null;
  };
};

type HeliusWalletBalance = {
  balance?: number;
  mint?: string;
  symbol?: string | null;
};

type HeliusBalancesResponse = {
  balances?: HeliusWalletBalance[];
  pagination?: {
    hasMore?: boolean;
    page?: number;
  };
};

type TransferWindowInput = {
  launchAt: string;
  tokenMint: string;
  tokenSymbol: string;
  transfers: Array<{
    amountRaw: string;
    direction: "in" | "out";
    mint: string;
    signature: string;
    timestamp: number;
  }>;
  currentBalance?: number;
  wallet: string;
};

const MAX_TRANSFER_PAGES = 50;

function normalizeWallet(wallet: string) {
  try {
    return new PublicKey(wallet.trim()).toBase58();
  } catch {
    throw new Error("Enter a valid Solana wallet address");
  }
}

function parseLaunchDate(launchAt: string) {
  const parsed = new Date(launchAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("LaunchONomics launch date is not configured correctly");
  }
  return parsed;
}

function buildWindowSet(launchDate: Date): LaunchonomicsWindowSet {
  return {
    first10MinutesEndsAt: new Date(
      launchDate.getTime() + 10 * 60_000,
    ).toISOString(),
    firstHourEndsAt: addHours(launchDate, 1).toISOString(),
    first12HoursEndsAt: addHours(launchDate, 12).toISOString(),
    first24HoursEndsAt: addHours(launchDate, 24).toISOString(),
  };
}

function getSubscriptionEnd(
  tier: LaunchonomicsTier,
  launchDate: Date,
) {
  switch (tier) {
    case "monthly":
      return addMonths(launchDate, 1).toISOString();
    case "yearly":
      return addYears(launchDate, 1).toISOString();
    case "five_year":
      return addYears(launchDate, 5).toISOString();
    default:
      return undefined;
  }
}

function getBadge(tier: LaunchonomicsTier): LaunchonomicsBadge {
  switch (tier) {
    case "lifetime":
      return "verified";
    case "monthly":
    case "yearly":
    case "five_year":
      return "launch-trader";
    default:
      return "none";
  }
}

function getSummary(
  tier: LaunchonomicsTier,
  tokenSymbol: string,
  tradedWithin24Hours: boolean,
) {
  switch (tier) {
    case "lifetime":
      return `This wallet traded ${tokenSymbol} and held through the first 24 hours, so it earns lifetime access and a verified badge.`;
    case "five_year":
      return `This wallet traded ${tokenSymbol} in the first 10 minutes and earns a 5-year subscription.`;
    case "yearly":
      return `This wallet traded ${tokenSymbol} in the first hour and earns a yearly subscription.`;
    case "monthly":
      return `This wallet traded ${tokenSymbol} in the first 12 hours and earns a monthly subscription.`;
    default:
      return tradedWithin24Hours
        ? `This wallet traded ${tokenSymbol} during launch day, but it did not earn a qualifying subscription window.`
        : `This wallet has no qualifying ${tokenSymbol} launch-day trade yet.`;
  }
}

export function evaluateLaunchonomicsWindow({
  launchAt,
  tokenMint,
  tokenSymbol,
  transfers,
  currentBalance,
  wallet,
}: TransferWindowInput): LaunchonomicsEvaluation {
  const launchDate = parseLaunchDate(launchAt);
  const launchMs = launchDate.getTime();
  const windows = buildWindowSet(launchDate);
  const first10MinutesEndsMs = new Date(windows.first10MinutesEndsAt).getTime();
  const firstHourEndsMs = new Date(windows.firstHourEndsAt).getTime();
  const first12HoursEndsMs = new Date(windows.first12HoursEndsAt).getTime();
  const first24HoursEndsMs = new Date(windows.first24HoursEndsAt).getTime();

  const launchDayTransfers = [...transfers]
    .filter(
      (transfer) =>
        transfer.mint === tokenMint &&
        transfer.timestamp * 1000 >= launchMs &&
        transfer.timestamp * 1000 <= first24HoursEndsMs,
    )
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }
      return left.signature.localeCompare(right.signature);
    });

  const firstTrade = launchDayTransfers[0];
  let runningBalance = BigInt(0);
  let everHeldPositiveBalance = false;
  let droppedToZeroBeforeDeadline = false;

  for (const transfer of launchDayTransfers) {
    const amount = BigInt(transfer.amountRaw);
    runningBalance += transfer.direction === "in" ? amount : -amount;

    if (runningBalance > 0) {
      everHeldPositiveBalance = true;
      continue;
    }

    if (everHeldPositiveBalance) {
      droppedToZeroBeforeDeadline = true;
    }
  }

  const tradedWithin24Hours = Boolean(firstTrade);
  const heldThrough24Hours =
    tradedWithin24Hours &&
    everHeldPositiveBalance &&
    runningBalance > 0 &&
    !droppedToZeroBeforeDeadline;

  let tier: LaunchonomicsTier = "none";
  if (firstTrade) {
    const firstTradeMs = firstTrade.timestamp * 1000;
    if (heldThrough24Hours) {
      tier = "lifetime";
    } else if (firstTradeMs <= first10MinutesEndsMs) {
      tier = "five_year";
    } else if (firstTradeMs <= firstHourEndsMs) {
      tier = "yearly";
    } else if (firstTradeMs <= first12HoursEndsMs) {
      tier = "monthly";
    }
  }

  return {
    wallet,
    tokenMint,
    tokenSymbol,
    launchAt: launchDate.toISOString(),
    firstTradeAt: firstTrade
      ? new Date(firstTrade.timestamp * 1000).toISOString()
      : undefined,
    tier,
    badge: getBadge(tier),
    qualifyingTradeCount: launchDayTransfers.length,
    tradedWithin24Hours,
    heldThrough24Hours,
    currentBalance,
    currentBalanceSymbol: currentBalance !== undefined ? tokenSymbol : undefined,
    summary: getSummary(tier, tokenSymbol, tradedWithin24Hours),
    subscriptionEndsAt: getSubscriptionEnd(tier, launchDate),
    windows,
  };
}

function getHeliusWalletUrl(wallet: string, path: "balances" | "transfers") {
  return `https://api.helius.xyz/v1/wallet/${wallet}/${path}`;
}

async function fetchHeliusJson<T>(url: string) {
  const env = getServerEnv();
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "X-Api-Key": env.HELIUS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Helius request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchLaunchDayTransfers(wallet: string, tokenMint: string, launchAt: string) {
  const launchMs = parseLaunchDate(launchAt).getTime();
  let cursor: string | null = null;
  const transfers: TransferWindowInput["transfers"] = [];

  for (let page = 0; page < MAX_TRANSFER_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const payload = await fetchHeliusJson<HeliusTransfersResponse>(
      `${getHeliusWalletUrl(wallet, "transfers")}?${params.toString()}`,
    );
    const pageItems = (payload.data ?? []).filter(
      (transfer): transfer is Required<
        Pick<
          HeliusWalletTransfer,
          "amountRaw" | "direction" | "mint" | "signature" | "timestamp"
        >
      > =>
        Boolean(
          transfer.amountRaw &&
            transfer.direction &&
            transfer.mint &&
            transfer.signature &&
            transfer.timestamp,
        ),
    );

    transfers.push(
      ...pageItems
        .filter((transfer) => transfer.mint === tokenMint)
        .map((transfer) => ({
          amountRaw: transfer.amountRaw,
          direction: transfer.direction,
          mint: transfer.mint,
          signature: transfer.signature,
          timestamp: transfer.timestamp,
        })),
    );

    const oldestTimestamp = pageItems.reduce<number | null>(
      (oldest, transfer) =>
        oldest === null || transfer.timestamp < oldest
          ? transfer.timestamp
          : oldest,
      null,
    );

    if (
      !payload.pagination?.hasMore ||
      !payload.pagination?.nextCursor ||
      (oldestTimestamp !== null && oldestTimestamp * 1000 < launchMs)
    ) {
      break;
    }

    cursor = payload.pagination.nextCursor;
  }

  return transfers;
}

async function fetchCurrentTokenBalance(wallet: string, tokenMint: string) {
  for (let page = 1; page <= 10; page += 1) {
    const payload = await fetchHeliusJson<HeliusBalancesResponse>(
      `${getHeliusWalletUrl(wallet, "balances")}?page=${page}&limit=100`,
    );
    const token = (payload.balances ?? []).find(
      (balance) => balance.mint === tokenMint,
    );
    if (token?.balance !== undefined) {
      return token.balance;
    }
    if (!payload.pagination?.hasMore) {
      return undefined;
    }
  }

  return undefined;
}

function assertLaunchonomicsConfigured() {
  const env = getServerEnv();
  if (!env.HELIUS_API_KEY) {
    throw new Error("HELIUS_API_KEY must be configured for LaunchONomics");
  }
  if (!env.LAUNCHONOMICS_TOKEN_MINT) {
    throw new Error(
      "LAUNCHONOMICS_TOKEN_MINT or BAGSTROKE_TOKEN_MINT must be configured",
    );
  }
  if (!env.LAUNCHONOMICS_LAUNCH_AT) {
    throw new Error(
      "LAUNCHONOMICS_LAUNCH_AT or NEXT_PUBLIC_FREE_ACCESS_UNTIL must be configured",
    );
  }
  return env;
}

export async function getLaunchonomicsEvaluation(wallet: string) {
  const env = assertLaunchonomicsConfigured();
  const normalizedWallet = normalizeWallet(wallet);
  const [transfers, currentBalance] = await Promise.all([
    fetchLaunchDayTransfers(
      normalizedWallet,
      env.LAUNCHONOMICS_TOKEN_MINT,
      env.LAUNCHONOMICS_LAUNCH_AT,
    ),
    fetchCurrentTokenBalance(normalizedWallet, env.LAUNCHONOMICS_TOKEN_MINT),
  ]);

  return evaluateLaunchonomicsWindow({
    wallet: normalizedWallet,
    launchAt: env.LAUNCHONOMICS_LAUNCH_AT,
    tokenMint: env.LAUNCHONOMICS_TOKEN_MINT,
    tokenSymbol:
      process.env.NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL?.trim() ||
      DEFAULT_ACCESS_TOKEN_SYMBOL,
    transfers,
    currentBalance,
  });
}
