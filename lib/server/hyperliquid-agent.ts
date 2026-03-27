import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";
import { Wallet } from "ethers";

import { getServerEnv } from "@/lib/env";
import { getAutonomousRiskControlPlane } from "@/lib/server/autonomous-treasury-policy";

export type HyperliquidAgentStatus = {
  actionNames: string[];
  apiUrl: string;
  apiWalletAddress: string | null;
  apiWalletApproved: boolean;
  blockedActionNames: string[];
  defaultDex: string | null;
  enabled: boolean;
  infoReady: boolean;
  livePerpsEnabled: boolean;
  masterWalletAddress: string | null;
  note: string | null;
  wsUrl: string;
};

export type HyperliquidResolvedPerpMarket = {
  assetIndex: number;
  coin: string;
  markPx: number;
  maxLeverage: number;
  midPx: number | null;
  szDecimals: number;
};

type HyperliquidOpenPerpPosition = {
  coin: string;
  entryPx: number;
  liquidationPx: number | null;
  marginUsed: number;
  maxLeverage: number;
  positionValue: number;
  side: "long" | "short";
  size: string;
  unrealizedPnl: number;
};

const AGENT_ONLY_HYPERLIQUID_ACTIONS = [
  "hyperliquid.market.meta",
  "hyperliquid.market.asset-contexts",
  "hyperliquid.market.funding-history",
  "hyperliquid.market.predicted-fundings",
  "hyperliquid.user.clearinghouse-state",
  "hyperliquid.user.active-asset-data",
  "hyperliquid.user.role",
] as const;

const LIVE_HYPERLIQUID_ACTIONS = [
  "hyperliquid.order.place",
  "hyperliquid.order.cancel",
  "hyperliquid.order.schedule-cancel",
] as const;

const BLOCKED_HUMAN_FACING_HYPERLIQUID_ACTIONS = [
  "hyperliquid.public-api-wallet",
  "hyperliquid.operator-console",
  "hyperliquid.manual-signing",
] as const;

const HYPERLIQUID_SIGNATURE_CHAIN_ID = "0xa4b1";
const DEFAULT_HYPERLIQUID_LEVERAGE = 3;

let cachedProbe:
  | {
      apiWalletApproved: boolean;
      checkedAtMs: number;
      note: string | null;
      ready: boolean;
    }
  | null = null;

function normalizeAddress(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized || null;
}

function normalizePositiveNumber(value: string | number | null | undefined) {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function deriveApiWalletAddress(secret: string) {
  const normalized = secret.trim();
  if (!normalized) {
    return null;
  }

  try {
    return normalizeAddress(new Wallet(normalized).address);
  } catch {
    return null;
  }
}

function getConfiguredApiWalletAddress() {
  const env = getServerEnv();
  const explicit = normalizeAddress(env.TIANSHI_HYPERLIQUID_API_WALLET);
  const derived = deriveApiWalletAddress(env.TIANSHI_HYPERLIQUID_API_WALLET_SECRET);

  if (explicit && derived && explicit !== derived) {
    return {
      address: explicit,
      mismatch: true,
    };
  }

  return {
    address: explicit || derived,
    mismatch: false,
  };
}

function normalizeHyperliquidCoin(value: string) {
  return value
    .trim()
    .replace(/^hyperliquid:/i, "")
    .replace(/^hl:/i, "")
    .toUpperCase();
}

export function toHyperliquidMarketKey(value: string) {
  return `hyperliquid:${normalizeHyperliquidCoin(value)}`;
}

export function getHyperliquidCoinFromMarketKey(value: string) {
  return normalizeHyperliquidCoin(value);
}

function getHyperliquidTransport() {
  const env = getServerEnv();

  return new HttpTransport({
    apiUrl: env.TIANSHI_HYPERLIQUID_API_URL,
    timeout: 10_000,
  });
}

function getHyperliquidInfoClient() {
  return new InfoClient({
    transport: getHyperliquidTransport(),
  });
}

function getHyperliquidApiWallet() {
  const env = getServerEnv();
  const secret = env.TIANSHI_HYPERLIQUID_API_WALLET_SECRET.trim();
  if (!secret) {
    throw new Error("Hyperliquid API wallet secret is not configured.");
  }

  const wallet = new Wallet(secret);
  const { address: configuredAddress, mismatch } = getConfiguredApiWalletAddress();
  if (mismatch) {
    throw new Error(
      "Hyperliquid API wallet address does not match the configured API wallet secret.",
    );
  }

  if (
    configuredAddress &&
    normalizeAddress(wallet.address) !== configuredAddress
  ) {
    throw new Error(
      "Derived Hyperliquid API wallet address does not match the configured API wallet.",
    );
  }

  return wallet;
}

function getHyperliquidExchangeClient() {
  const wallet = getHyperliquidApiWallet();

  return new ExchangeClient({
    signatureChainId: HYPERLIQUID_SIGNATURE_CHAIN_ID,
    transport: getHyperliquidTransport(),
    wallet,
  });
}

async function resolveHyperliquidPerpMarket(
  coinOrMarketKey: string,
  dex?: string | null,
): Promise<HyperliquidResolvedPerpMarket> {
  const info = getHyperliquidInfoClient();
  const normalizedCoin = normalizeHyperliquidCoin(coinOrMarketKey);
  const requestedDex = dex?.trim() || getServerEnv().TIANSHI_HYPERLIQUID_DEFAULT_DEX.trim();
  const [meta, assetCtxs] = requestedDex
    ? await info.metaAndAssetCtxs({ dex: requestedDex })
    : await info.metaAndAssetCtxs();
  const assetIndex = meta.universe.findIndex(
    (entry) => entry.name.toUpperCase() === normalizedCoin,
  );

  if (assetIndex < 0) {
    throw new Error(`Hyperliquid perpetual market ${normalizedCoin} is unavailable.`);
  }

  const universeEntry = meta.universe[assetIndex];
  const assetCtx = assetCtxs[assetIndex];
  if (!universeEntry || !assetCtx) {
    throw new Error(`Hyperliquid market context for ${normalizedCoin} is incomplete.`);
  }

  return {
    assetIndex,
    coin: normalizedCoin,
    markPx: normalizePositiveNumber(assetCtx.markPx),
    maxLeverage: universeEntry.maxLeverage,
    midPx: assetCtx.midPx ? normalizePositiveNumber(assetCtx.midPx) : null,
    szDecimals: universeEntry.szDecimals,
  };
}

async function getHyperliquidOpenPerpPosition(
  coinOrMarketKey: string,
): Promise<HyperliquidOpenPerpPosition | null> {
  const env = getServerEnv();
  const masterWalletAddress = normalizeAddress(env.TIANSHI_HYPERLIQUID_MASTER_WALLET);
  if (!masterWalletAddress) {
    throw new Error("Hyperliquid master wallet is not configured.");
  }

  const info = getHyperliquidInfoClient();
  const requestedDex = env.TIANSHI_HYPERLIQUID_DEFAULT_DEX.trim();
  const clearinghouse = requestedDex
    ? await info.clearinghouseState({
        dex: requestedDex,
        user: masterWalletAddress as `0x${string}`,
      })
    : await info.clearinghouseState({
        user: masterWalletAddress as `0x${string}`,
      });
  const normalizedCoin = normalizeHyperliquidCoin(coinOrMarketKey);
  const position = clearinghouse.assetPositions.find(
    (entry) => entry.position.coin.toUpperCase() === normalizedCoin,
  )?.position;

  if (!position) {
    return null;
  }

  const size = normalizePositiveNumber(position.szi);
  if (size === 0) {
    return null;
  }

  return {
    coin: normalizedCoin,
    entryPx: normalizePositiveNumber(position.entryPx),
    liquidationPx: position.liquidationPx
      ? normalizePositiveNumber(position.liquidationPx)
      : null,
    marginUsed: normalizePositiveNumber(position.marginUsed),
    maxLeverage: position.maxLeverage,
    positionValue: normalizePositiveNumber(position.positionValue),
    side: Number(position.szi) >= 0 ? "long" : "short",
    size: String(Math.abs(Number(position.szi))),
    unrealizedPnl: Number(position.unrealizedPnl),
  };
}

function mapUserRoleResponse(role:
  | { role: "missing" | "user" | "vault" }
  | { role: "agent"; data: { user: `0x${string}` } }
  | { role: "subAccount"; data: { master: `0x${string}` } },
) {
  switch (role.role) {
    case "user":
      return "User" as const;
    case "agent":
      return "Agent" as const;
    case "vault":
      return "Vault" as const;
    case "subAccount":
      return "Subaccount" as const;
    default:
      return "Missing" as const;
  }
}

function extractSuccessfulOrderStatus(
  statuses: (
    | { error: string }
    | { filled: { avgPx: string; oid: number; totalSz: string } }
    | { resting: { oid: number } }
    | "waitingForFill"
    | "waitingForTrigger"
  )[],
  action: string,
) {
  const status = statuses[0];
  if (!status) {
    throw new Error(`Hyperliquid ${action} returned no order status.`);
  }

  if (status === "waitingForFill" || status === "waitingForTrigger") {
    throw new Error(
      `Hyperliquid ${action} is still pending; autonomous mode only accepts immediately resolved market-style orders.`,
    );
  }

  if ("error" in status) {
    throw new Error(status.error);
  }

  if ("resting" in status) {
    throw new Error(
      `Hyperliquid ${action} left a resting order on the book; autonomous mode requires immediate execution.`,
    );
  }

  return {
    averagePrice: normalizePositiveNumber(status.filled.avgPx),
    orderId: status.filled.oid,
    size: status.filled.totalSz,
  };
}

function getExecutionPriceBufferPct() {
  const riskPlane = getAutonomousRiskControlPlane();
  return Math.max(0.25, riskPlane.slippageLiquidityGuard.maxPriceImpactPct);
}

function getDefaultLeverage(maxLeverage: number, requested?: number | null) {
  const target = requested && requested > 0 ? requested : DEFAULT_HYPERLIQUID_LEVERAGE;
  return Math.max(1, Math.min(Math.floor(target), Math.floor(maxLeverage)));
}

function assertHyperliquidLivePerpsEnabled() {
  const status = getHyperliquidAgentStatus();
  if (!status.enabled) {
    throw new Error("Hyperliquid perps ability is disabled.");
  }

  if (!status.infoReady) {
    throw new Error(status.note || "Hyperliquid market data is not ready.");
  }

  if (!status.livePerpsEnabled) {
    throw new Error(
      status.note ||
        "Hyperliquid live perp routing is still gated until the shared API wallet is approved.",
    );
  }

  return status;
}

export async function fetchHyperliquidPerpMetaAndAssetCtxs(dex?: string | null) {
  const info = getHyperliquidInfoClient();
  const requestedDex = dex?.trim() || undefined;
  return requestedDex ? info.metaAndAssetCtxs({ dex: requestedDex }) : info.metaAndAssetCtxs();
}

export async function fetchHyperliquidClearinghouseState(args: {
  dex?: string | null;
  user: string;
}) {
  const info = getHyperliquidInfoClient();
  const requestedDex = args.dex?.trim() || undefined;
  return requestedDex
    ? info.clearinghouseState({
        dex: requestedDex,
        user: args.user.trim().toLowerCase() as `0x${string}`,
      })
    : info.clearinghouseState({
        user: args.user.trim().toLowerCase() as `0x${string}`,
      });
}

export async function fetchHyperliquidFundingHistory(args: {
  coin: string;
  endTime?: number;
  startTime: number;
}) {
  const info = getHyperliquidInfoClient();
  return info.fundingHistory({
    coin: normalizeHyperliquidCoin(args.coin),
    endTime: args.endTime,
    startTime: args.startTime,
  });
}

export async function fetchHyperliquidUserRole(user: string) {
  const info = getHyperliquidInfoClient();
  const role = await info.userRole({
    user: user.trim().toLowerCase() as `0x${string}`,
  });

  return mapUserRoleResponse(role);
}

export async function warmHyperliquidAgentAbility() {
  const env = getServerEnv();
  if (env.TIANSHI_HYPERLIQUID_ENABLED !== "true") {
    cachedProbe = {
      apiWalletApproved: false,
      checkedAtMs: Date.now(),
      note: "Hyperliquid perps ability is disabled.",
      ready: false,
    };
    return cachedProbe;
  }

  if (cachedProbe && Date.now() - cachedProbe.checkedAtMs < 5 * 60_000) {
    return cachedProbe;
  }

  const { address: apiWalletAddress, mismatch } = getConfiguredApiWalletAddress();
  const defaultDex = env.TIANSHI_HYPERLIQUID_DEFAULT_DEX.trim();

  try {
    await fetchHyperliquidPerpMetaAndAssetCtxs(defaultDex || undefined);

    let apiWalletApproved = false;
    let note =
      env.TIANSHI_HYPERLIQUID_ALLOW_LIVE === "true"
        ? "Perp market data is reachable. Live routing still needs an approved API wallet."
        : "Perp market data is reachable. Live routing remains gated off.";

    if (mismatch) {
      note =
        "Hyperliquid API wallet address does not match the configured API wallet secret.";
    } else if (apiWalletAddress) {
      const role = await fetchHyperliquidUserRole(apiWalletAddress);
      apiWalletApproved = role === "Agent";
      note = apiWalletApproved
        ? env.TIANSHI_HYPERLIQUID_ALLOW_LIVE === "true"
          ? "Perp market data is reachable and the shared Tianshi API wallet is approved."
          : "Perp market data is reachable and the shared Tianshi API wallet is approved; live routing stays gated off."
        : `Perp market data is reachable, but the configured API wallet role is ${role}.`;
    }

    cachedProbe = {
      apiWalletApproved,
      checkedAtMs: Date.now(),
      note,
      ready: true,
    };
  } catch (error) {
    cachedProbe = {
      apiWalletApproved: false,
      checkedAtMs: Date.now(),
      note: error instanceof Error ? error.message : "Probe failed.",
      ready: false,
    };
  }

  return cachedProbe;
}

export function getHyperliquidAgentStatus(): HyperliquidAgentStatus {
  const env = getServerEnv();
  const enabled = env.TIANSHI_HYPERLIQUID_ENABLED === "true";
  const masterWalletAddress = normalizeAddress(env.TIANSHI_HYPERLIQUID_MASTER_WALLET);
  const { address: apiWalletAddress, mismatch } = getConfiguredApiWalletAddress();
  const hasApiWalletSecret = Boolean(env.TIANSHI_HYPERLIQUID_API_WALLET_SECRET.trim());
  const apiWalletApproved = Boolean(cachedProbe?.apiWalletApproved);
  const infoReady = enabled && (cachedProbe?.ready ?? true);
  const livePerpsEnabled =
    enabled &&
    infoReady &&
    env.TIANSHI_HYPERLIQUID_ALLOW_LIVE === "true" &&
    Boolean(masterWalletAddress) &&
    Boolean(apiWalletAddress) &&
    hasApiWalletSecret &&
    !mismatch &&
    apiWalletApproved;

  let note = cachedProbe?.note ?? null;
  if (!enabled) {
    note = "Hyperliquid perps ability is disabled.";
  } else if (mismatch) {
    note =
      "Hyperliquid API wallet address does not match the configured API wallet secret.";
  } else if (!note) {
    note = "Hyperliquid perps are configured and awaiting the next reachability probe.";
  }

  return {
    actionNames: enabled
      ? livePerpsEnabled
        ? [...AGENT_ONLY_HYPERLIQUID_ACTIONS, ...LIVE_HYPERLIQUID_ACTIONS]
        : [...AGENT_ONLY_HYPERLIQUID_ACTIONS]
      : [],
    apiUrl: env.TIANSHI_HYPERLIQUID_API_URL,
    apiWalletAddress,
    apiWalletApproved,
    blockedActionNames: [...BLOCKED_HUMAN_FACING_HYPERLIQUID_ACTIONS],
    defaultDex: env.TIANSHI_HYPERLIQUID_DEFAULT_DEX.trim() || null,
    enabled,
    infoReady,
    livePerpsEnabled,
    masterWalletAddress,
    note,
    wsUrl: env.TIANSHI_HYPERLIQUID_WS_URL,
  };
}

export async function placeHyperliquidPerpOrder(args: {
  coin: string;
  leverage?: number | null;
  notionalUsdc: number;
  side: "long" | "short";
}) {
  assertHyperliquidLivePerpsEnabled();

  const market = await resolveHyperliquidPerpMarket(args.coin);
  const exchange = getHyperliquidExchangeClient();
  const leverage = getDefaultLeverage(market.maxLeverage, args.leverage);
  const referencePrice = market.midPx || market.markPx;
  const priceBufferPct = getExecutionPriceBufferPct();
  const orderPrice =
    args.side === "long"
      ? referencePrice * (1 + priceBufferPct / 100)
      : referencePrice * (1 - priceBufferPct / 100);
  const orderSize = formatSize(args.notionalUsdc / referencePrice, market.szDecimals);

  await exchange.updateLeverage({
    asset: market.assetIndex,
    isCross: true,
    leverage,
  });

  const response = await exchange.order({
    grouping: "na",
    orders: [
      {
        a: market.assetIndex,
        b: args.side === "long",
        p: formatPrice(orderPrice, market.szDecimals, "perp"),
        r: false,
        s: orderSize,
        t: { limit: { tif: "FrontendMarket" } },
      },
    ],
  });
  const status = extractSuccessfulOrderStatus(
    response.response.data.statuses as (
      | { error: string }
      | { filled: { avgPx: string; oid: number; totalSz: string } }
      | { resting: { oid: number } }
      | "waitingForFill"
      | "waitingForTrigger"
    )[],
    "entry",
  );

  return {
    acquiredAmountRaw: status.size,
    buySignature: `hyperliquid:order:${status.orderId}`,
    entryPrice: status.averagePrice || referencePrice,
    leverage,
  };
}

export async function closeHyperliquidPerpPosition(args: {
  coin: string;
  entryUsdc: number;
}) {
  assertHyperliquidLivePerpsEnabled();

  const position = await getHyperliquidOpenPerpPosition(args.coin);
  if (!position) {
    return {
      exitUsdc: 0,
      sellSignature: null,
      soldAmountRaw: "0",
    };
  }

  const market = await resolveHyperliquidPerpMarket(position.coin);
  const exchange = getHyperliquidExchangeClient();
  const priceBufferPct = getExecutionPriceBufferPct();
  const referencePrice = market.midPx || market.markPx;
  const closePrice =
    position.side === "short"
      ? referencePrice * (1 + priceBufferPct / 100)
      : referencePrice * (1 - priceBufferPct / 100);
  const response = await exchange.order({
    grouping: "na",
    orders: [
      {
        a: market.assetIndex,
        b: position.side === "short",
        p: formatPrice(closePrice, market.szDecimals, "perp"),
        r: true,
        s: formatSize(position.size, market.szDecimals),
        t: { limit: { tif: "FrontendMarket" } },
      },
    ],
  });
  const status = extractSuccessfulOrderStatus(
    response.response.data.statuses as (
      | { error: string }
      | { filled: { avgPx: string; oid: number; totalSz: string } }
      | { resting: { oid: number } }
      | "waitingForFill"
      | "waitingForTrigger"
    )[],
    "close",
  );

  return {
    exitUsdc: Math.max(
      0,
      Number((args.entryUsdc + position.unrealizedPnl).toFixed(6)),
    ),
    sellSignature: `hyperliquid:close:${status.orderId}`,
    soldAmountRaw: status.size,
  };
}
