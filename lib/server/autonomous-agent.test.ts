import { beforeEach, describe, expect, it } from "vitest";

import {
  applyAutonomousRevenueAllocation,
  getAutonomousFeed,
  getAutonomousStatus,
  queueAutonomousSelfModificationProposal,
  queueAutonomousTradeDirective,
  publishAutonomousGoonBookPost,
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
    expect(result.allocated.burnUsdc).toBe(40);
    expect(result.allocated.tradingUsdc).toBe(11);
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

  it("degrades the runtime when reserve falls below the hard floor", async () => {
    const current = getAutonomousSnapshot();
    setAutonomousSnapshot({
      ...current,
      reserveSol: 0.05,
    });

    const next = await tickAutonomousHeartbeat("reserve breach test");

    expect(next.runtimePhase).toBe("degraded");
    expect(next.latestPolicyDecision).toContain("Reserve floor breach detected");
  });

  it("force-liquidates open positions", async () => {
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

    const next = await performAutonomousControl(
      "force_liquidate",
      "test liquidation",
      {
        executor: {
          async executeBuybackBurn() {
            throw new Error("not used");
          },
          async executeTrade() {
            throw new Error("not used");
          },
          async liquidateTrade() {
            return {
              exitUsdc: 11.5,
              sellSignature: "sig-liquidation",
              soldAmountRaw: "100",
            };
          },
          async settleOwnerPayout() {
            throw new Error("not used");
          },
          async settleReserveRebalance() {
            throw new Error("not used");
          },
        },
      },
    );

    expect(next.runtimePhase).toBe("sleeping");
    expect(next.positions[0]?.status).toBe("closed");
    expect(next.positions[0]?.exitUsdc).toBe(11.5);
  });

  it("records self-mod approval through owner control", async () => {
    queueAutonomousSelfModificationProposal({
      summary: "Auto-direct chartsync trades into a verified meme coin.",
      title: "Session trade tuning",
      tuningPatch: {
        preferredSessionTradeMint: "pump-mint-1",
        preferredSessionTradeSymbol: "PUMP1",
      },
    });
    const next = await performAutonomousControl("approve_self_mod");

    expect(next.selfModification.pendingProposal).toBeNull();
    expect(next.selfModification.currentTuning.preferredSessionTradeMint).toBe(
      "pump-mint-1",
    );
    expect(next.selfModification.lastOutcome).toContain("Owner approved");
  });

  it("queues and executes a treasury trade directive through the settlement loop", async () => {
    recordAutonomousRevenue("creator_fee", 100, "creator fees");
    queueAutonomousTradeDirective({
      marketMint: "pump-mint-2",
      rationale: "Test treasury trade",
      requestedUsdc: 1,
      symbol: "PUMP2",
    });

    const next = await tickAutonomousHeartbeat("trade execution test", {
      executor: {
        async executeBuybackBurn() {
          return {
            acquiredAmountRaw: "41000000",
            burnSignature: "sig-burn",
            buySignature: "sig-buyburn",
          };
        },
        async executeTrade() {
          return {
            acquiredAmountRaw: "123000000",
            buySignature: "sig-trade",
          };
        },
        async liquidateTrade() {
          throw new Error("not used");
        },
        async settleOwnerPayout() {
          return {
            destinationTokenAccount: "owner-ata",
            signature: "sig-owner",
          };
        },
        async settleReserveRebalance() {
          return {
            destinationTokenAccount: "treasury-ata",
            signature: "sig-reserve",
          };
        },
      },
    });

    expect(next.tradeDirectives[0]?.status).toBe("executed");
    expect(next.positions.some((position) => position.marketMint === "pump-mint-2")).toBe(
      true,
    );
    expect(next.revenueBuckets.tradingUsdc).toBe(10);
  });

  it("creates replica child runtimes from owner control", async () => {
    const next = await performAutonomousControl("trigger_replication", "Mirror child");

    expect(next.replication.enabled).toBe(true);
    expect(next.replication.childCount).toBe(1);
    expect(next.replication.children[0]?.label).toBe("Mirror child");
  });

  it("spawns an uncapped replica child during each active heartbeat", async () => {
    const first = await tickAutonomousHeartbeat("replication heartbeat one");
    const second = await tickAutonomousHeartbeat("replication heartbeat two");

    expect(first.replication.childCount).toBe(1);
    expect(second.replication.childCount).toBe(2);
    expect(second.replication.children[1]?.label).toBe("Replica 2");
  });

  it("publishes first-party BitClaw notes through the runtime", async () => {
    const result = await publishAutonomousGoonBookPost({
      body: "Rotation stays risk-on while liquidity and wallet follow-through hold up.",
      tokenSymbol: "$BONK",
      stance: "bullish",
    });

    expect(result.post.agentId).toBe("goonclaw");
    expect(result.post.tokenSymbol).toBe("$BONK");
    expect(result.snapshot.latestPolicyDecision).toBe(
      "Published a first-party BitClaw post.",
    );
    expect(getAutonomousFeed(5).some((event) => event.kind === "social")).toBe(true);
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
        destinationHost: "billing.conway.tech",
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
    expect(snapshot.latestPolicyDecision).toContain("directive");
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

  it("opens the persisted circuit breaker after repeated discretionary settlement failures", async () => {
    const current = getAutonomousSnapshot();
    setAutonomousSnapshot({
      ...current,
      revenueBuckets: {
        ...current.revenueBuckets,
        ownerUsdc: 1,
        totalProcessedUsdc: 1,
      },
    });

    let next = getAutonomousSnapshot();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      next = await performAutonomousControl("force_settle", `breaker-${attempt}`, {
        executor: {
          async executeBuybackBurn() {
            throw new Error("not used");
          },
          async executeTrade() {
            throw new Error("not used");
          },
          async liquidateTrade() {
            throw new Error("not used");
          },
          async settleOwnerPayout() {
            throw new Error("owner payout failed");
          },
          async settleReserveRebalance() {
            throw new Error("not used");
          },
        },
      });
    }

    expect(next.control.circuitBreakerState?.status).toBe("open");
    expect(getAutonomousStatus().circuitBreakerState?.status).toBe("open");
  });
});
