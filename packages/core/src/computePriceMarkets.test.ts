import { createComputeMarketState } from "@/packages/core/src/computeMarket";
import {
  buildReferenceComputePrice,
  createComputePriceMarketState,
  placeForecastPosition,
  upsertComputeForecastQuestion,
  upsertComputePerpContract,
} from "@/packages/core/src/computePriceMarkets";

describe("compute price discovery", () => {
  it("falls back to spot only when no perps or forecasts are available", () => {
    const computeMarket = createComputeMarketState({
      assignments: [
        {
          agreedUnitPrice: 0.5,
          agreedUnits: 100,
          bidId: "bid:1",
          buyerActorId: "buyer",
          capability: "compute",
          createdAt: "2026-03-27T00:00:00.000Z",
          id: "assignment:1",
          offerId: "offer:1",
          region: "local",
          requestId: "request:1",
          resourceClass: "gpu_second",
          sellerActorId: "seller",
          status: "completed",
          tier: "core",
          updatedAt: "2026-03-27T00:00:00.000Z",
        },
      ],
      completions: [
        {
          assignmentId: "assignment:1",
          completedAt: "2026-03-27T00:05:00.000Z",
          deliveredUnits: 100,
          id: "completion:1",
          priceCurrency: "USD",
          totalPrice: 50,
        },
      ],
      offers: [],
      requests: [],
      bids: [],
    });

    const reference = buildReferenceComputePrice({
      computeMarketState: computeMarket,
      region: "local",
      resourceClass: "gpu_second",
      state: createComputePriceMarketState(),
      tier: "core",
    });

    expect(reference.referencePrice).toBe(0.5);
    expect(reference.liquidityMode).toBe("spot_only");
  });

  it("combines spot, perp, and forecast inputs when all are present", () => {
    const computeMarket = createComputeMarketState({
      assignments: [
        {
          agreedUnitPrice: 0.5,
          agreedUnits: 100,
          bidId: "bid:1",
          buyerActorId: "buyer",
          capability: "compute",
          createdAt: "2026-03-27T00:00:00.000Z",
          id: "assignment:1",
          offerId: "offer:1",
          region: "local",
          requestId: "request:1",
          resourceClass: "gpu_second",
          sellerActorId: "seller",
          status: "completed",
          tier: "core",
          updatedAt: "2026-03-27T00:00:00.000Z",
        },
      ],
      completions: [
        {
          assignmentId: "assignment:1",
          completedAt: "2026-03-27T00:05:00.000Z",
          deliveredUnits: 100,
          id: "completion:1",
          priceCurrency: "USD",
          totalPrice: 50,
        },
      ],
      offers: [],
      requests: [],
      bids: [],
    });

    let priceState = createComputePriceMarketState();
    priceState = upsertComputePerpContract(priceState, {
      epochEndAt: "2026-03-27T01:00:00.000Z",
      epochStartAt: "2026-03-27T00:00:00.000Z",
      id: "perp:gpu",
      lastPrice: 0.59,
      markPrice: 0.6,
      region: "local",
      resourceClass: "gpu_second",
      settlementCurrency: "USD",
      source: "nezha",
      status: "open",
      tier: "core",
      updatedAt: "2026-03-27T00:10:00.000Z",
    });
    priceState = upsertComputeForecastQuestion(priceState, {
      closesAt: "2026-03-27T00:20:00.000Z",
      id: "forecast:gpu",
      prompt: "above threshold",
      region: "local",
      resolvesAt: "2026-03-27T01:00:00.000Z",
      resourceClass: "gpu_second",
      status: "open",
      thresholdPrice: 0.7,
      tier: "core",
      updatedAt: "2026-03-27T00:10:00.000Z",
    });
    priceState = placeForecastPosition(priceState, {
      actorId: "actor:1",
      createdAt: "2026-03-27T00:11:00.000Z",
      id: "forecast-position:1",
      impliedProbability: 0.5,
      questionId: "forecast:gpu",
      selection: "yes",
      stake: 10,
      updatedAt: "2026-03-27T00:11:00.000Z",
    });

    const reference = buildReferenceComputePrice({
      computeMarketState: computeMarket,
      region: "local",
      resourceClass: "gpu_second",
      state: priceState,
      tier: "core",
    });

    expect(reference.referencePrice).toBe(0.5025);
    expect(reference.liquidityMode).toBe("full_blend");
  });
});
