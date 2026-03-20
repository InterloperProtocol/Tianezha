import { getServerEnv } from "@/lib/env";
import { DEFAULT_CHART_SYMBOL } from "@/lib/token-defaults";
import { ChartCandle, ChartSnapshot, FunscriptPayload, LiveCommand } from "@/lib/types";
import { clamp, seededNumber } from "@/lib/utils";

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSyntheticCandles(contractAddress: string, lastPrice: number) {
  const candles: ChartCandle[] = [];
  const start = Math.floor(Date.now() / 1000) - 59 * 60;
  let cursor = Math.max(lastPrice, 0.000001);

  for (let index = 0; index < 60; index += 1) {
    const noise = (seededNumber(contractAddress, index) - 0.5) * 0.08;
    const momentum = (seededNumber(contractAddress, index + 60) - 0.5) * 0.04;
    const open = cursor;
    const close = Math.max(0.000001, open * (1 + noise + momentum));
    const high = Math.max(open, close) * (1 + seededNumber(contractAddress, index + 120) * 0.04);
    const low = Math.min(open, close) * (1 - seededNumber(contractAddress, index + 180) * 0.04);
    const volume = 500 + seededNumber(contractAddress, index + 240) * 9_500;
    candles.push({
      time: start + index * 60,
      open,
      high,
      low,
      close,
      volume,
    });
    cursor = close;
  }

  return candles;
}

async function fetchDexScreener(contractAddress: string) {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
    { next: { revalidate: 15 } },
  );
  if (!response.ok) throw new Error(`DexScreener failed: ${response.status}`);
  const payload = (await response.json()) as {
    pairs?: Array<Record<string, unknown>>;
  };

  const pair =
    payload.pairs?.find((candidate) => String(candidate.chainId) === "solana") ??
    payload.pairs?.[0];

  if (!pair) {
    throw new Error("No trading pair found");
  }

  const priceUsd = safeNumber(pair.priceUsd, 0);
  return {
    name: String(pair.baseToken ? (pair.baseToken as { name?: string }).name ?? "Unknown Token" : "Unknown Token"),
    symbol: String(pair.baseToken ? (pair.baseToken as { symbol?: string }).symbol ?? "UNK" : "UNK"),
    priceUsd,
    marketCapUsd: safeNumber(pair.marketCap, safeNumber(pair.fdv)),
    liquidityUsd: safeNumber(pair.liquidity ? (pair.liquidity as { usd?: number }).usd : 0),
    volume24hUsd: safeNumber(pair.volume ? (pair.volume as { h24?: number }).h24 : 0),
    change5mPct: safeNumber(pair.priceChange ? (pair.priceChange as { m5?: number }).m5 : 0),
    change1hPct: safeNumber(pair.priceChange ? (pair.priceChange as { h1?: number }).h1 : 0),
    pairUrl: String(pair.url ?? `https://dexscreener.com/solana/${contractAddress}`),
  };
}

async function fetchBirdeyeCandles(contractAddress: string) {
  const apiKey = getServerEnv().BIRDEYE_API_KEY;
  if (!apiKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60;
  const response = await fetch(
    `https://public-api.birdeye.so/defi/ohlcv?address=${contractAddress}&type=1m&time_from=${from}&time_to=${now}`,
    {
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana",
      },
      next: { revalidate: 15 },
    },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    data?: { items?: Array<{ unixTime: number; o: number; h: number; l: number; c: number; v: number }> };
  };

  const items = payload.data?.items ?? [];
  if (!items.length) return null;

  return items.map((item) => ({
    time: item.unixTime,
    open: item.o,
    high: item.h,
    low: item.l,
    close: item.c,
    volume: item.v,
  }));
}

export async function loadChartSnapshot(contractAddress: string): Promise<ChartSnapshot> {
  const dex = await fetchDexScreener(contractAddress).catch(() => null);
  const birdeyeCandles = await fetchBirdeyeCandles(contractAddress).catch(() => null);
  const fallbackPrice = dex?.priceUsd || 0.0002 + seededNumber(contractAddress, 999) * 0.01;
  const candles = birdeyeCandles ?? buildSyntheticCandles(contractAddress, fallbackPrice);

  const latest = candles[candles.length - 1];

  return {
    contractAddress,
    name: dex?.name ?? "Synthetic Pair",
    symbol: dex?.symbol ?? DEFAULT_CHART_SYMBOL,
    priceUsd: dex?.priceUsd ?? latest.close,
    marketCapUsd: dex?.marketCapUsd ?? latest.close * 1_000_000,
    liquidityUsd: dex?.liquidityUsd ?? latest.volume * 20,
    volume24hUsd: dex?.volume24hUsd ?? candles.reduce((sum, candle) => sum + candle.volume, 0),
    change5mPct: dex?.change5mPct ?? ((latest.close - candles[Math.max(0, candles.length - 6)].close) / candles[Math.max(0, candles.length - 6)].close) * 100,
    change1hPct: dex?.change1hPct ?? ((latest.close - candles[0].close) / candles[0].close) * 100,
    pairUrl: dex?.pairUrl ?? `https://dexscreener.com/solana/${contractAddress}`,
    candles,
    source: birdeyeCandles ? "birdeye" : dex ? "dexscreener" : "synthetic",
  };
}

function computeMomentum(candles: ChartCandle[]) {
  const latest = candles[candles.length - 1];
  const short = candles.slice(-5);
  const long = candles.slice(-15);
  const avg = (items: ChartCandle[]) => items.reduce((sum, item) => sum + item.close, 0) / items.length;
  const avgVolume = (items: ChartCandle[]) =>
    items.reduce((sum, item) => sum + item.volume, 0) / items.length;
  const shortAvg = avg(short);
  const longAvg = avg(long);
  const volatility =
    short.reduce((sum, item) => sum + Math.abs(item.close - item.open) / Math.max(item.open, 0.000001), 0) /
    short.length;
  const trend = (shortAvg - longAvg) / Math.max(longAvg, 0.000001);
  const volumeRatio = latest.volume / Math.max(avgVolume(short), 0.000001);

  return {
    volatility,
    trend,
    volumeRatio,
  };
}

export function deriveLiveCommand(snapshot: ChartSnapshot, tickMs: number): LiveCommand {
  const metrics = computeMomentum(snapshot.candles);
  const pulse = (Math.sin(tickMs / 1600) + 1) / 2;
  const speed = clamp(
    Math.round(
      22 +
        Math.abs(metrics.trend) * 700 +
        metrics.volatility * 420 +
        Math.min(metrics.volumeRatio, 3) * 6 +
        pulse * 12,
    ),
    12,
    92,
  );
  const amplitude = clamp(
    Math.round(
      12 +
        metrics.volatility * 400 +
        Math.abs(metrics.trend) * 120 +
        Math.min(metrics.volumeRatio, 3) * 3,
    ),
    8,
    44,
  );
  const bias = clamp(metrics.trend * 160, -18, 18);
  const center = 50 + bias;
  const minY = clamp(Math.round(center - amplitude), 6, 90);
  const maxY = clamp(Math.round(center + amplitude), 10, 94);
  const position = clamp(Math.round(center + Math.sin(tickMs / 700) * amplitude * 0.6), 0, 100);

  return {
    speed,
    amplitude,
    minY,
    maxY,
    position,
  };
}

export function buildHandyStreamPoints(command: LiveCommand, horizonMs = 5000, stepMs = 250) {
  const points: Array<{ t: number; x: number }> = [];
  const amplitude = (command.maxY - command.minY) / 2;
  const center = command.minY + amplitude;
  const cyclesPerSecond = Math.max(command.speed / 60, 0.15);

  for (let t = 0; t <= horizonMs; t += stepMs) {
    const phase = (t / 1000) * cyclesPerSecond * Math.PI * 2;
    const x = clamp(Math.round(center + Math.sin(phase) * amplitude), 0, 100);
    points.push({ t, x });
  }

  return points;
}

export function buildGeneratedFunscript(snapshot: ChartSnapshot): FunscriptPayload {
  const latestCandles = snapshot.candles.slice(-40);
  const actions: FunscriptPayload["actions"] = [];
  let clock = 0;

  for (const candle of latestCandles) {
    const body = candle.close - candle.open;
    const range = candle.high - candle.low;
    const baseline = clamp(50 + (body / Math.max(candle.open, 0.000001)) * 600, 10, 90);
    const spread = clamp(range / Math.max(candle.open, 0.000001) * 1_200, 8, 40);
    const low = clamp(Math.round(baseline - spread / 2), 0, 100);
    const high = clamp(Math.round(baseline + spread / 2), 0, 100);
    actions.push({ at: clock, pos: low });
    actions.push({ at: clock + 750, pos: high });
    actions.push({ at: clock + 1_500, pos: low });
    clock += 3_000;
  }

  return {
    version: "1.0",
    inverted: false,
    range: 90,
    actions,
    metadata: {
      contractAddress: snapshot.contractAddress,
      source: snapshot.source,
      symbol: snapshot.symbol,
    },
  };
}
