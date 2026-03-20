import { describe, expect, it } from "vitest";

import {
  buildGeneratedFunscript,
  buildHandyStreamPoints,
  deriveLiveCommand,
} from "@/lib/server/chart";
import { DEFAULT_CHART_SYMBOL } from "@/lib/token-defaults";
import { ChartSnapshot } from "@/lib/types";

function makeSnapshot(): ChartSnapshot {
  return {
    contractAddress: "bagstroke-test-contract",
    symbol: DEFAULT_CHART_SYMBOL,
    name: "BagStroke",
    priceUsd: 0.012,
    marketCapUsd: 1200000,
    liquidityUsd: 250000,
    volume24hUsd: 950000,
    change5mPct: 8.25,
    change1hPct: 21.4,
    pairUrl: "https://dexscreener.com/solana/bagstroke-test-contract",
    source: "synthetic",
    candles: Array.from({ length: 40 }, (_, index) => {
      const open = 0.01 + index * 0.0001;
      const close = open + (index % 2 === 0 ? 0.0002 : -0.00005);
      return {
        time: 1_700_000_000 + index * 60,
        open,
        high: close + 0.00015,
        low: open - 0.0001,
        close,
        volume: 1000 + index * 25,
      };
    }),
  };
}

describe("chart motion engine", () => {
  it("keeps live commands inside safe bounds", () => {
    const command = deriveLiveCommand(makeSnapshot(), 1_700_000_000_000);

    expect(command.speed).toBeGreaterThanOrEqual(12);
    expect(command.speed).toBeLessThanOrEqual(92);
    expect(command.amplitude).toBeGreaterThanOrEqual(8);
    expect(command.amplitude).toBeLessThanOrEqual(44);
    expect(command.minY).toBeGreaterThanOrEqual(0);
    expect(command.maxY).toBeLessThanOrEqual(100);
    expect(command.minY).toBeLessThan(command.maxY);
  });

  it("builds handy stream points and generated scripts from candles", () => {
    const snapshot = makeSnapshot();
    const command = deriveLiveCommand(snapshot, 1_700_000_010_000);
    const points = buildHandyStreamPoints(command, 2000, 250);
    const script = buildGeneratedFunscript(snapshot);

    expect(points.length).toBe(9);
    expect(points.every((point) => point.x >= 0 && point.x <= 100)).toBe(true);
    expect(script.actions.length).toBe(snapshot.candles.length * 3);
    expect(script.metadata).toMatchObject({
      contractAddress: snapshot.contractAddress,
      symbol: snapshot.symbol,
      source: snapshot.source,
    });
  });
});
