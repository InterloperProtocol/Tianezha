import { beforeEach, describe, expect, it } from "vitest";

import {
  applyAutonomousRevenueAllocation,
  recordAutonomousRevenue,
  performAutonomousControl,
  tickAutonomousHeartbeat,
} from "@/lib/server/autonomous-agent";
import {
  getAutonomousSnapshot,
  resetAutonomousStoreForTests,
  setAutonomousSnapshot,
} from "@/lib/server/autonomous-store";
import {
  assertAutonomousTradeAllowed,
  assertAutonomousTreasuryInstructionAllowed,
  calculateAutonomousPortfolioValueUsdc,
} from "@/lib/server/autonomous-treasury-policy";

describe("autonomous agent policy", () => {
  beforeEach(() => {
    resetAutonomousStoreForTests();
  });

  it("routes creator fees to owner, burn, and trading buckets", () => {
    const current = getAutonomousSnapshot();
    const result = applyAutonomousRevenueAllocation(
      "creator_fee",
      100,
      current.revenueBuckets,
    );

    expect(result.allocated.ownerUsdc).toBe(49);
    expect(result.allocated.burnUsdc).toBe(41);
    expect(result.allocated.tradingUsdc).toBe(10);
    expect(result.allocated.reserveUsdc).toBe(0);
    expect(result.allocated.sessionTradeUsdc).toBe(0);
    expect(result.nextBuckets.totalProcessedUsdc).toBe(100);
  });

  it("routes goonclaw chartsync revenue into burn and session trading", () => {
    const current = getAutonomousSnapshot();
    const result = applyAutonomousRevenueAllocation(
      "goonclaw_chartsync",
      20,
      current.revenueBuckets,
    );

    expect(result.allocated.burnUsdc).toBe(10);
    expect(result.allocated.sessionTradeUsdc).toBe(10);
    expect(result.allocated.ownerUsdc).toBe(0);
    expect(result.allocated.reserveUsdc).toBe(0);
  });

  it("degrades the runtime when reserve falls below the hard floor", () => {
    const current = getAutonomousSnapshot();
    setAutonomousSnapshot({
      ...current,
      reserveSol: 0.05,
    });

    const next = tickAutonomousHeartbeat("reserve breach test");

    expect(next.runtimePhase).toBe("degraded");
    expect(next.latestPolicyDecision).toContain("Reserve floor breach detected");
  });

  it("force-liquidates open positions", () => {
    const current = getAutonomousSnapshot();
    setAutonomousSnapshot({
      ...current,
      positions: [
        {
          id: "position-1",
          status: "open",
          source: "goonclaw_chartsync",
          marketMint: "mint-1",
          symbol: "TEST",
          venue: "gmgn",
          entryUsdc: 12,
          currentUsdc: 11.5,
          rationale: "test",
          openedAt: new Date().toISOString(),
        },
      ],
    });

    const next = performAutonomousControl("force_liquidate", "test liquidation");

    expect(next.runtimePhase).toBe("liquidating");
    expect(next.positions[0]?.status).toBe("closed");
    expect(next.positions[0]?.exitUsdc).toBe(11.5);
  });

  it("records self-mod approval through owner control", () => {
    const next = performAutonomousControl("approve_self_mod");

    expect(next.selfModification.pendingProposal).toBeNull();
    expect(next.selfModification.lastOutcome).toContain("Owner approved");
  });

  it("blocks arbitrary private-address transfers", () => {
    expect(() =>
      assertAutonomousTreasuryInstructionAllowed({
        destinationAddress: "ArbitraryWallet111111111111111111111111111111",
        kind: "arbitrary_transfer",
      }),
    ).toThrow(/blocks arbitrary transfers/i);
  });

  it("only allows partner payouts to the configured owner wallet", () => {
    expect(() =>
      assertAutonomousTreasuryInstructionAllowed({
        destinationAddress: "ArbitraryWallet111111111111111111111111111111",
        kind: "owner_payout",
      }),
    ).toThrow(/configured owner wallet/i);
  });

  it("allows Conway service access only through the allowlisted host set", () => {
    expect(() =>
      assertAutonomousTreasuryInstructionAllowed({
        destinationHost: "billing.conway.ai",
        kind: "conway_infrastructure_payment",
      }),
    ).not.toThrow();

    expect(() =>
      assertAutonomousTreasuryInstructionAllowed({
        destinationHost: "evil.example.com",
        kind: "conway_infrastructure_payment",
      }),
    ).toThrow(/allowlist/i);
  });

  it("blocks non-pump assets and over-sized meme coin positions", () => {
    expect(() =>
      assertAutonomousTradeAllowed({
        assetMint: "mint-1",
        isPumpCoin: false,
        portfolioValueUsdc: 100,
        requestedNotionalUsdc: 5,
        venue: "gmgn",
      }),
    ).toThrow(/Pump meme coins/i);

    expect(() =>
      assertAutonomousTradeAllowed({
        assetMint: "mint-2",
        isPumpCoin: true,
        portfolioValueUsdc: 100,
        requestedNotionalUsdc: 11,
        venue: "gmgn",
      }),
    ).toThrow(/10% of the portfolio/i);
  });

  it("blocks non-pump trading venues even for pump coins", () => {
    expect(() =>
      assertAutonomousTradeAllowed({
        assetMint: "mint-3",
        isPumpCoin: true,
        portfolioValueUsdc: 100,
        requestedNotionalUsdc: 5,
        venue: "pumpfun",
      }),
    ).toThrow(/GMGN route/i);
  });

  it("queues chartsync trade capital until a pump-verified token is supplied", () => {
    recordAutonomousRevenue("goonclaw_chartsync", 20, "session revenue");
    const snapshot = getAutonomousSnapshot();

    expect(snapshot.revenueBuckets.sessionTradeUsdc).toBe(10);
    expect(snapshot.positions).toHaveLength(0);
    expect(snapshot.latestPolicyDecision).toContain("queued");
  });

  it("calculates tracked portfolio value from liquid balance, trade buckets, and open positions", () => {
    const portfolioValueUsdc = calculateAutonomousPortfolioValueUsdc({
      usdcBalance: 12,
      revenueBuckets: {
        ownerUsdc: 0,
        burnUsdc: 0,
        reserveUsdc: 0,
        tradingUsdc: 3,
        sessionTradeUsdc: 2,
        totalProcessedUsdc: 17,
      },
      positions: [
        {
          id: "position-2",
          status: "open",
          source: "goonclaw_chartsync",
          marketMint: "mint-4",
          symbol: "TEST",
          venue: "gmgn",
          entryUsdc: 4,
          currentUsdc: 5,
          rationale: "test",
          openedAt: new Date().toISOString(),
        },
      ],
    });

    expect(portfolioValueUsdc).toBe(22);
  });
});
