import { getServerEnv } from "@/lib/env";
import type { PolymarketMarketSnapshot } from "@/lib/simulation/types";

type PolymarketApiMarket = {
  active?: boolean;
  closed?: boolean;
  endDate?: string | null;
  id?: string | number;
  liquidity?: number | string | null;
  outcomePrices?: string | string[] | null;
  question?: string | null;
  slug?: string | null;
  volume?: number | string | null;
};

export type PolymarketAgentMode = "read_only" | "paper" | "live";

export type PolymarketAgentStatus = {
  actionNames: string[];
  blockedActionNames: string[];
  clobUrl: string;
  defaultMode: PolymarketAgentMode;
  enabled: boolean;
  gammaUrl: string;
  liveReady: boolean;
  note: string | null;
  readOnlyReady: boolean;
  tosAcknowledged: boolean;
};

const AGENT_ONLY_POLYMARKET_ACTIONS = [
  "polymarket.markets.list",
  "polymarket.market.inspect",
  "polymarket.call.create",
  "polymarket.trade.intent",
] as const;

const BLOCKED_HUMAN_FACING_POLYMARKET_ACTIONS = [
  "polymarket.public-buy",
  "polymarket.public-sell",
  "polymarket.operator-console",
] as const;

let cachedProbe:
  | {
      checkedAtMs: number;
      note: string | null;
      ready: boolean;
    }
  | null = null;

function parsePrice(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOutcomePrices(
  outcomePrices: PolymarketApiMarket["outcomePrices"],
) {
  if (Array.isArray(outcomePrices)) {
    return outcomePrices.map((value) => parsePrice(value));
  }

  if (typeof outcomePrices === "string") {
    try {
      const parsed = JSON.parse(outcomePrices) as string[];
      return parsed.map((value) => parsePrice(value));
    } catch {
      return [parsePrice(outcomePrices)];
    }
  }

  return [];
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPolymarketAgentStatus(): PolymarketAgentStatus {
  const env = getServerEnv();
  const enabled = env.TIANSHI_POLYMARKET_ENABLED === "true";
  const tosAcknowledged = env.TIANSHI_POLYMARKET_TOS_ACK === "true";
  const readOnlyReady = enabled && Boolean(cachedProbe?.ready);
  const liveReady =
    readOnlyReady &&
    env.TIANSHI_POLYMARKET_ALLOW_LIVE === "true" &&
    tosAcknowledged;

  return {
    actionNames: enabled ? [...AGENT_ONLY_POLYMARKET_ACTIONS] : [],
    blockedActionNames: [...BLOCKED_HUMAN_FACING_POLYMARKET_ACTIONS],
    clobUrl: env.TIANSHI_POLYMARKET_CLOB_URL,
    defaultMode: env.TIANSHI_POLYMARKET_DEFAULT_MODE,
    enabled,
    gammaUrl: env.TIANSHI_POLYMARKET_GAMMA_URL,
    liveReady,
    note: cachedProbe?.note ?? null,
    readOnlyReady,
    tosAcknowledged,
  };
}

export async function warmPolymarketAgentAbility() {
  const env = getServerEnv();
  if (env.TIANSHI_POLYMARKET_ENABLED !== "true") {
    cachedProbe = {
      checkedAtMs: Date.now(),
      note: "Polymarket agent mode is disabled.",
      ready: false,
    };
    return cachedProbe;
  }

  if (cachedProbe && Date.now() - cachedProbe.checkedAtMs < 5 * 60_000) {
    return cachedProbe;
  }

  try {
    const response = await fetch(
      `${env.TIANSHI_POLYMARKET_GAMMA_URL.replace(/\/$/, "")}/markets?active=true&closed=false&archived=false&limit=2`,
      {
        method: "GET",
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    cachedProbe = {
      checkedAtMs: Date.now(),
      note:
        env.TIANSHI_POLYMARKET_ALLOW_LIVE === "true" &&
        env.TIANSHI_POLYMARKET_TOS_ACK === "true"
          ? "Gamma API reachable and live mode explicitly allowed."
          : "Gamma API reachable. Live execution remains gated off.",
      ready: true,
    };
  } catch (error) {
    cachedProbe = {
      checkedAtMs: Date.now(),
      note: error instanceof Error ? error.message : "Probe failed.",
      ready: false,
    };
  }

  return cachedProbe;
}

export async function fetchPolymarketMarkets(limit = 8) {
  const env = getServerEnv();
  const response = await fetch(
    `${env.TIANSHI_POLYMARKET_GAMMA_URL.replace(/\/$/, "")}/markets?active=true&closed=false&archived=false&limit=${Math.max(1, limit)}`,
    {
      method: "GET",
      next: { revalidate: 60 },
    },
  );

  if (!response.ok) {
    throw new Error(`Unable to load Polymarket Gamma markets. HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as PolymarketApiMarket[];
  const timestamp = new Date().toISOString();

  return payload
    .map((market) => {
      const prices = normalizeOutcomePrices(market.outcomePrices);
      const id = String(market.id ?? "");
      if (!id || !market.question) {
        return null;
      }

      const slug = market.slug?.trim() || null;
      return {
        active: Boolean(market.active) && !Boolean(market.closed),
        closeTime: market.endDate || null,
        createdAt: timestamp,
        id,
        liquidity: toNumber(market.liquidity),
        noPrice: prices[1] ?? null,
        question: market.question,
        slug,
        updatedAt: timestamp,
        url: slug
          ? `https://polymarket.com/event/${slug}`
          : `https://gamma-api.polymarket.com/markets/${id}`,
        volume: toNumber(market.volume),
        yesPrice: prices[0] ?? null,
      } satisfies PolymarketMarketSnapshot;
    })
    .filter(Boolean) as PolymarketMarketSnapshot[];
}

