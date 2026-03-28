import {
  assignBestComputeOffer,
  createComputeMarketState,
  upsertComputeOffer,
  upsertComputeRequest,
} from "@/packages/core/src/computeMarket";

describe("compute market", () => {
  it("matches lowest price first, then higher reliability, then lower latency", () => {
    let state = createComputeMarketState();
    state = upsertComputeOffer(state, {
      actorId: "seller:a",
      availableUnits: 100,
      capability: "compute",
      createdAt: "2026-03-27T00:00:00.000Z",
      id: "offer:a",
      latencyMs: 80,
      maxUnits: 100,
      minUnits: 10,
      peerId: "peer:a",
      priceCurrency: "USD",
      region: "local",
      reliabilityScore: 0.93,
      resourceClass: "cpu_second",
      rewardClass: "simulated",
      settlementAdapters: ["manual_invoice"],
      status: "open",
      tier: "edge",
      title: "A",
      unitPrice: 0.12,
      updatedAt: "2026-03-27T00:00:00.000Z",
    });
    state = upsertComputeOffer(state, {
      actorId: "seller:b",
      availableUnits: 100,
      capability: "compute",
      createdAt: "2026-03-27T00:00:00.000Z",
      id: "offer:b",
      latencyMs: 55,
      maxUnits: 100,
      minUnits: 10,
      peerId: "peer:b",
      priceCurrency: "USD",
      region: "local",
      reliabilityScore: 0.97,
      resourceClass: "cpu_second",
      rewardClass: "simulated",
      settlementAdapters: ["manual_invoice"],
      status: "open",
      tier: "edge",
      title: "B",
      unitPrice: 0.12,
      updatedAt: "2026-03-27T00:00:00.000Z",
    });
    state = upsertComputeOffer(state, {
      actorId: "seller:c",
      availableUnits: 100,
      capability: "compute",
      createdAt: "2026-03-27T00:00:00.000Z",
      id: "offer:c",
      latencyMs: 25,
      maxUnits: 100,
      minUnits: 10,
      peerId: "peer:c",
      priceCurrency: "USD",
      region: "local",
      reliabilityScore: 0.91,
      resourceClass: "cpu_second",
      rewardClass: "simulated",
      settlementAdapters: ["manual_invoice"],
      status: "open",
      tier: "edge",
      title: "C",
      unitPrice: 0.1,
      updatedAt: "2026-03-27T00:00:00.000Z",
    });
    state = upsertComputeRequest(state, {
      actorId: "buyer",
      capability: "compute",
      createdAt: "2026-03-27T00:00:00.000Z",
      id: "request:1",
      maxLatencyMs: 100,
      maxUnitPrice: 0.15,
      minReliabilityScore: 0.9,
      peerId: "peer:buyer",
      requestedUnits: 40,
      resourceClass: "cpu_second",
      rewardClass: "simulated",
      settlementAdapters: ["manual_invoice"],
      status: "open",
      region: "local",
      tier: "edge",
      title: "Need compute",
      updatedAt: "2026-03-27T00:00:00.000Z",
    });

    const next = assignBestComputeOffer({
      assignmentId: "assignment:1",
      bidId: "bid:1",
      requestId: "request:1",
      state,
    });

    expect(next.assignments[0]?.sellerActorId).toBe("seller:c");
    expect(next.requests[0]?.status).toBe("assigned");
  });

  it("works without Conway as a settlement adapter", () => {
    let state = createComputeMarketState();
    state = upsertComputeOffer(state, {
      actorId: "seller",
      availableUnits: 200,
      capability: "storage",
      createdAt: "2026-03-27T00:00:00.000Z",
      id: "offer:storage",
      latencyMs: 40,
      maxUnits: 200,
      minUnits: 50,
      peerId: "peer:seller",
      priceCurrency: "USD",
      region: "mesh-east",
      reliabilityScore: 0.96,
      resourceClass: "storage_gb_hour",
      rewardClass: "simulated",
      settlementAdapters: ["manual_invoice", "solana_memo"],
      status: "open",
      tier: "community",
      title: "Storage",
      unitPrice: 0.04,
      updatedAt: "2026-03-27T00:00:00.000Z",
    });
    state = upsertComputeRequest(state, {
      actorId: "buyer",
      capability: "storage",
      createdAt: "2026-03-27T00:00:00.000Z",
      id: "request:storage",
      maxLatencyMs: 50,
      maxUnitPrice: 0.05,
      minReliabilityScore: 0.95,
      peerId: "peer:buyer",
      requestedUnits: 80,
      resourceClass: "storage_gb_hour",
      rewardClass: "simulated",
      settlementAdapters: ["manual_invoice"],
      status: "open",
      region: "mesh-east",
      tier: "community",
      title: "Need storage",
      updatedAt: "2026-03-27T00:00:00.000Z",
    });

    const next = assignBestComputeOffer({
      assignmentId: "assignment:storage",
      bidId: "bid:storage",
      requestId: "request:storage",
      state,
    });

    expect(next.assignments[0]?.sellerActorId).toBe("seller");
    expect(next.assignments[0]?.settlementIntent).toBeNull();
  });
});
