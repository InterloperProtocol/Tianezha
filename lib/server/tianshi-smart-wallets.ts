import { getServerEnv } from "@/lib/env";
import {
  AutonomousSmartWallet,
  AutonomousWalletAnalytics,
} from "@/lib/types";

const SMART_WALLET_CACHE_MS = 5 * 60_000;
const SMART_WALLET_USER_AGENT = "Tianshi Smart Wallets/1.0";

type CachedIntel = {
  expiresAt: number;
  value: SmartWalletIntel;
};

type RawRecord = Record<string, unknown>;

type SmartWalletIntel = {
  topMessages: string[];
  trackedWallets: AutonomousSmartWallet[];
  walletAnalytics: AutonomousWalletAnalytics[];
};

const SMART_WALLET_CACHE = new Map<string, CachedIntel>();

function coerceNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function baseUrl() {
  return getServerEnv().TIANSHI_GMGN_API_HOST.replace(/\/+$/, "");
}

function extractList(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as RawRecord;
  const data = (root.data ?? root) as unknown;
  if (Array.isArray(data)) {
    return data.filter((item): item is RawRecord => Boolean(item) && typeof item === "object");
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  for (const key of ["rank", "wallets", "list", "users", "messages", "holdings"]) {
    const candidate = (data as RawRecord)[key];
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is RawRecord => Boolean(item) && typeof item === "object");
    }
  }

  for (const value of Object.values(data as RawRecord)) {
    if (Array.isArray(value)) {
      return value.filter((item): item is RawRecord => Boolean(item) && typeof item === "object");
    }
  }

  return [];
}

function walletAddress(record: RawRecord) {
  const value = record.wallet_address ?? record.address ?? record.wallet ?? record.owner;
  return typeof value === "string" ? value.trim() : "";
}

function walletLabel(record: RawRecord, fallback: string) {
  const value =
    record.twitter_name ??
    record.name ??
    record.nickname ??
    record.username ??
    record.handle ??
    record.label;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return `${fallback.slice(0, 4)}...${fallback.slice(-4)}`;
}

function socialHandle(record: RawRecord) {
  const value =
    record.twitter_username ??
    record.screen_name ??
    record.twitter_handle ??
    record.username;
  return typeof value === "string" && value.trim() ? value.trim().replace(/^@/, "") : null;
}

function normalizeSymbol(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/[^A-Za-z0-9$]/g, "").slice(0, 16).toUpperCase();
}

function holdingSymbols(records: RawRecord[]) {
  const symbols = records
    .map((record) => normalizeSymbol(record.symbol ?? record.token_symbol ?? record.name))
    .filter(Boolean);

  return [...new Set(symbols)].slice(0, 6);
}

function holdingMints(records: RawRecord[]) {
  const mints = records
    .map((record) => {
      const value = record.token_address ?? record.mint ?? record.address ?? record.contract_address;
      return typeof value === "string" ? value.trim() : "";
    })
    .filter(Boolean);

  return [...new Set(mints)].slice(0, 8);
}

function classifyWallet(args: {
  holdings: string[];
  pnl7d: number;
  pnl30d: number;
  winRatePct: number;
}) {
  if (args.winRatePct >= 70 && args.pnl7d > 0) {
    return {
      modifiers: ["Legendary Timing", "High Conviction"],
      personality: "Tape sniper",
      secondary: "Momentum enjoyer",
      style: "Momentum sniper",
    };
  }

  if (args.pnl30d > args.pnl7d && args.pnl30d > 0) {
    return {
      modifiers: ["Narrative Loyalty", "High Conviction"],
      personality: "Narrative believer",
      secondary: "Swing holder",
      style: "Conviction swing",
    };
  }

  if (args.pnl7d < 0 && args.holdings.length >= 4) {
    return {
      modifiers: ["Maximum Hopium", "Emotional Trading"],
      personality: "Hope recycler",
      secondary: "Bag defender",
      style: "Chaos surf",
    };
  }

  return {
    modifiers: ["Degenerate Risk Tolerance"],
    personality: "Fast rotator",
    secondary: "Liquidity scout",
    style: "Rapid rotation",
  };
}

function buildWalletAnalytics(args: {
  wallet: string;
  label: string;
  source: "smart_money" | "kol" | "payer";
  holdings: string[];
  pnl7d: number;
  pnl30d: number;
  winRatePct: number;
}) {
  const profile = classifyWallet(args);
  const holdingsSummary = args.holdings.length
    ? `Still touching ${args.holdings.slice(0, 3).join(", ")}.`
    : "Wallet is light on visible holdings.";
  const narrativeSummary = `${args.label} is running a ${profile.style.toLowerCase()} tape with ${args.winRatePct.toFixed(
    0,
  )}% win rate and ${args.pnl7d.toFixed(1)} 7d PnL. ${holdingsSummary}`;

  return {
    estimatedPnlSol: args.pnl7d,
    label: args.label,
    memorableMoments: [
      args.pnl7d >= 0
        ? "Kept the weekly tape green."
        : "Weekly tape took damage but kept firing.",
      holdingsSummary,
    ],
    narrativeSummary,
    pnl30d: args.pnl30d,
    pnl7d: args.pnl7d,
    solReceived: Math.max(0, args.pnl7d),
    solSpent: Math.max(0, Math.abs(args.pnl30d) + args.holdings.length),
    source: args.source,
    styleClassification: profile.style,
    wallet: args.wallet,
    walletMemo: `${args.label}: ${profile.style}, ${args.winRatePct.toFixed(
      0,
    )}% WR, ${args.pnl7d.toFixed(1)} 7d PnL.`,
    walletModifiers: profile.modifiers,
    walletPersonality: profile.personality,
    walletSecondaryPersonality: profile.secondary,
    winRatePct: args.winRatePct,
  } satisfies AutonomousWalletAnalytics;
}

async function fetchJson(pathName: string) {
  const response = await fetch(`${baseUrl()}${pathName}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": SMART_WALLET_USER_AGENT,
    },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GMGN request failed: ${response.status} ${pathName}`);
  }

  return response.json();
}

async function fetchWalletRanking(tag: string, chain = "sol") {
  return extractList(
    await fetchJson(
      `/defi/quotation/v1/rank/${chain}/wallets/7d?tag=${encodeURIComponent(
        tag,
      )}&orderby=pnl_7d&direction=desc`,
    ),
  );
}

async function fetchWalletDetail(address: string, chain = "sol") {
  const payload = await fetchJson(
    `/defi/quotation/v1/smartmoney/${chain}/walletNew/${address}`,
  );
  if (payload && typeof payload === "object" && "data" in (payload as RawRecord)) {
    const data = (payload as RawRecord).data;
    return data && typeof data === "object" ? (data as RawRecord) : null;
  }
  return null;
}

async function fetchWalletHoldings(address: string, chain = "sol") {
  const payload = await fetchJson(
    `/pf/api/v1/wallet/${chain}/${address}/holdings?limit=50&order_by=last_active_timestamp&direction=desc&hide_small=false&sellout=true&hide_abnormal=false`,
  );
  return extractList(payload);
}

async function fetchKOLMessages() {
  const payload = await fetchJson(
    "/vas/api/v1/twitter/messages?has_token=false&user_tags=kol&tw_types=tweet&tw_types=reply&limit=20",
  );

  return extractList(payload)
    .map((record) => {
      const value = record.text ?? record.content ?? record.body ?? record.message;
      return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
    })
    .filter((value) => value.length >= 24)
    .slice(0, 8);
}

function buildSmartWallet(
  record: RawRecord,
  detail: RawRecord | null,
  holdings: RawRecord[],
  source: "smart_money" | "kol",
) {
  const wallet = walletAddress(record);
  const label = walletLabel(detail ?? record, wallet);
  const pnl7d = coerceNumber(
    record.pnl_7d,
    record.pnl7d,
    detail?.pnl_7d,
    detail?.pnl7d,
  );
  const pnl30d = coerceNumber(
    record.pnl_30d,
    record.pnl30d,
    detail?.pnl_30d,
    detail?.pnl30d,
  );
  const winRatePct = clamp(
    coerceNumber(
      record.winrate,
      record.win_rate,
      detail?.winrate,
      detail?.win_rate,
      50,
    ),
    0,
    100,
  );
  const holdingsList = holdingSymbols(holdings);
  const analytics = buildWalletAnalytics({
    holdings: holdingsList,
    label,
    pnl30d,
    pnl7d,
    source,
    wallet,
    winRatePct,
  });

  return {
    analytics,
    wallet: {
      holdings: holdingsList,
      label,
      narrativeSummary: analytics.narrativeSummary,
      notableMints: holdingMints(holdings),
      pnl30d,
      pnl7d,
      score: Math.round(clamp(winRatePct * 0.55 + pnl7d * 3 + holdingsList.length * 4, 1, 99)),
      socialHandle: socialHandle(detail ?? record),
      socialUrl: socialHandle(detail ?? record)
        ? `https://x.com/${socialHandle(detail ?? record)}`
        : null,
      source,
      wallet,
      walletMemo: analytics.walletMemo,
      winRatePct,
    } satisfies AutonomousSmartWallet,
  };
}

async function fetchTrackedWallets(limit = 6) {
  const rankingTags = [
    { source: "smart_money" as const, tag: "smart_degen" },
    { source: "smart_money" as const, tag: "launchpad_smart" },
    { source: "kol" as const, tag: "renowned" },
  ];
  const rankings = await Promise.allSettled(
    rankingTags.map(async (config) => ({
      items: await fetchWalletRanking(config.tag),
      source: config.source,
    })),
  );

  const seen = new Map<string, "smart_money" | "kol">();
  for (const ranking of rankings) {
    if (ranking.status !== "fulfilled") {
      continue;
    }

    for (const record of ranking.value.items) {
      const wallet = walletAddress(record);
      if (!wallet || seen.has(wallet)) {
        continue;
      }
      seen.set(wallet, ranking.value.source);
      if (seen.size >= limit) {
        break;
      }
    }

    if (seen.size >= limit) {
      break;
    }
  }

  const tracked = await Promise.allSettled(
    [...seen.entries()].map(async ([wallet, source]) => {
      const [detailResult, holdingsResult] = await Promise.allSettled([
        fetchWalletDetail(wallet),
        fetchWalletHoldings(wallet),
      ]);

      return buildSmartWallet(
        { address: wallet },
        detailResult.status === "fulfilled" ? detailResult.value : null,
        holdingsResult.status === "fulfilled" ? holdingsResult.value : [],
        source,
      );
    }),
  );

  return tracked.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

export async function fetchSmartWalletIntel(limit = 6) {
  const cacheKey = `smart-wallets:${limit}`;
  const cached = SMART_WALLET_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const [trackedWallets, topMessages] = await Promise.all([
    fetchTrackedWallets(limit),
    fetchKOLMessages().catch(() => []),
  ]);

  const value = {
    topMessages,
    trackedWallets: trackedWallets
      .map((item) => item.wallet)
      .sort((left, right) => right.score - left.score),
    walletAnalytics: trackedWallets
      .map((item) => item.analytics)
      .sort(
        (left, right) =>
          (right.winRatePct ?? 0) + (right.estimatedPnlSol ?? 0) -
          ((left.winRatePct ?? 0) + (left.estimatedPnlSol ?? 0)),
      ),
  } satisfies SmartWalletIntel;

  SMART_WALLET_CACHE.set(cacheKey, {
    expiresAt: Date.now() + SMART_WALLET_CACHE_MS,
    value,
  });

  return value;
}

export async function fetchWalletAnalytics(wallet: string) {
  const trimmed = wallet.trim();
  if (!trimmed) {
    return null;
  }

  const cacheKey = `wallet:${trimmed}`;
  const cached = SMART_WALLET_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value.walletAnalytics[0] ?? null;
  }

  try {
    const [detailResult, holdingsResult] = await Promise.allSettled([
      fetchWalletDetail(trimmed),
      fetchWalletHoldings(trimmed),
    ]);
    const detail =
      detailResult.status === "fulfilled" ? detailResult.value : null;
    const holdings =
      holdingsResult.status === "fulfilled" ? holdingsResult.value : [];
    const analytics = buildWalletAnalytics({
      holdings: holdingSymbols(holdings),
      label: walletLabel(detail ?? { address: trimmed }, trimmed),
      pnl30d: coerceNumber(detail?.pnl_30d, detail?.pnl30d),
      pnl7d: coerceNumber(detail?.pnl_7d, detail?.pnl7d),
      source: "payer",
      wallet: trimmed,
      winRatePct: clamp(
        coerceNumber(detail?.winrate, detail?.win_rate, 50),
        0,
        100,
      ),
    });

    SMART_WALLET_CACHE.set(cacheKey, {
      expiresAt: Date.now() + SMART_WALLET_CACHE_MS,
      value: {
        topMessages: [],
        trackedWallets: [],
        walletAnalytics: [analytics],
      },
    });

    return analytics;
  } catch {
    return {
      label: `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`,
      memorableMoments: ["Payment arrived from a fresh wallet surface."],
      narrativeSummary: "Wallet analytics could not fetch a full smart-money dossier, so Tianshi stored a lightweight memo only.",
      source: "payer",
      styleClassification: "Unclassified payer",
      wallet: trimmed,
      walletMemo: `Wallet ${trimmed.slice(0, 4)}...${trimmed.slice(-4)} paid the stream.`,
      walletModifiers: [],
      walletPersonality: "Unclassified",
      walletSecondaryPersonality: null,
    } satisfies AutonomousWalletAnalytics;
  }
}
