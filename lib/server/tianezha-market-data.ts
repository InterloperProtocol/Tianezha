import { loadChartSnapshot } from "@/lib/server/chart";
import type { BenchmarkQuote, TokenWorld } from "@/lib/simulation/types";
import { seededNumber } from "@/lib/utils";

type BinanceTickerPayload = {
  lastPrice?: string;
  priceChangePercent?: string;
  symbol?: string;
};

const BENCHMARK_FALLBACKS = {
  BNB: 620,
  BTC: 88_000,
  ETH: 4_200,
  SOL: 175,
} as const;

async function fetchBenchmarkTicker(symbol: "BTC" | "ETH" | "SOL" | "BNB") {
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`,
    {
      next: { revalidate: 30 },
    },
  );

  if (!response.ok) {
    throw new Error(`Benchmark quote failed for ${symbol}`);
  }

  const payload = (await response.json()) as BinanceTickerPayload;
  const priceUsd = Number(payload.lastPrice);
  const change24hPct = Number(payload.priceChangePercent);

  if (!Number.isFinite(priceUsd)) {
    throw new Error(`Invalid benchmark quote for ${symbol}`);
  }

  return {
    asOf: new Date().toISOString(),
    change24hPct: Number.isFinite(change24hPct) ? change24hPct : null,
    priceUsd,
    source: "binance",
    symbol,
  } satisfies BenchmarkQuote;
}

function buildFallbackQuote(symbol: "BTC" | "ETH" | "SOL" | "BNB") {
  const baseline = BENCHMARK_FALLBACKS[symbol];
  const priceUsd = baseline * (0.94 + seededNumber(symbol, 7) * 0.12);

  return {
    asOf: new Date().toISOString(),
    change24hPct: (seededNumber(symbol, 17) - 0.5) * 12,
    priceUsd,
    source: "synthetic",
    symbol,
  } satisfies BenchmarkQuote;
}

export async function getBenchmarkQuote(symbol: "BTC" | "ETH" | "SOL" | "BNB") {
  return fetchBenchmarkTicker(symbol).catch(() => buildFallbackQuote(symbol));
}

export async function getBenchmarkQuotes() {
  const [btc, eth, sol, bnb] = await Promise.all([
    getBenchmarkQuote("BTC"),
    getBenchmarkQuote("ETH"),
    getBenchmarkQuote("SOL"),
    getBenchmarkQuote("BNB"),
  ]);

  return [btc, eth, sol, bnb];
}

function buildSyntheticWorldQuote(world: TokenWorld, benchmarkPrice: number) {
  const multiplier = 0.0025 + seededNumber(world.id, 51) * 0.006;
  return {
    asOf: new Date().toISOString(),
    priceUsd: benchmarkPrice * multiplier,
    source: "benchmark-derived",
  };
}

export async function getTokenWorldQuote(world: TokenWorld) {
  if (world.contractAddress) {
    const snapshot = await loadChartSnapshot(world.contractAddress).catch(() => null);
    if (snapshot) {
      return {
        asOf: new Date().toISOString(),
        pairUrl: snapshot.pairUrl,
        priceUsd: snapshot.priceUsd,
        source: snapshot.source,
      };
    }
  }

  const benchmarkQuote = await getBenchmarkQuote(world.benchmarkSymbol);
  return buildSyntheticWorldQuote(world, benchmarkQuote.priceUsd);
}
