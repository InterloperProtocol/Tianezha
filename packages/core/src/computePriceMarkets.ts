import { buildSpotIndex, createComputeMarketState } from "@/packages/core/src/computeMarket";
import type {
  ComputeForecastPosition,
  ComputeForecastQuestion,
  ComputeMarketState,
  ComputePerpContract,
  ComputePerpPosition,
  ComputePriceMarketState,
  ReferenceComputePrice,
} from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

export function createComputePriceMarketState(
  overrides?: Partial<ComputePriceMarketState>,
): ComputePriceMarketState {
  return {
    forecastPositions: overrides?.forecastPositions ?? [],
    forecastQuestions: overrides?.forecastQuestions ?? [],
    id: overrides?.id ?? "tianezha-compute-price-markets",
    indexBars: overrides?.indexBars ?? [],
    perpContracts: overrides?.perpContracts ?? [],
    perpPositions: overrides?.perpPositions ?? [],
    referencePrices: overrides?.referencePrices ?? [],
    updatedAt: overrides?.updatedAt ?? nowIso(),
  };
}

export function upsertComputePerpContract(
  state: ComputePriceMarketState,
  contract: ComputePerpContract,
): ComputePriceMarketState {
  return {
    ...state,
    perpContracts: [
      ...state.perpContracts.filter((entry) => entry.id !== contract.id),
      contract,
    ],
    updatedAt: nowIso(),
  };
}

export function upsertComputeForecastQuestion(
  state: ComputePriceMarketState,
  question: ComputeForecastQuestion,
): ComputePriceMarketState {
  return {
    ...state,
    forecastQuestions: [
      ...state.forecastQuestions.filter((entry) => entry.id !== question.id),
      question,
    ],
    updatedAt: nowIso(),
  };
}

export function upsertComputePerpPosition(
  state: ComputePriceMarketState,
  position: ComputePerpPosition,
): ComputePriceMarketState {
  return {
    ...state,
    perpPositions: [
      ...state.perpPositions.filter((entry) => entry.id !== position.id),
      position,
    ],
    updatedAt: nowIso(),
  };
}

export function placeForecastPosition(
  state: ComputePriceMarketState,
  position: ComputeForecastPosition,
): ComputePriceMarketState {
  return {
    ...state,
    forecastPositions: [
      ...state.forecastPositions.filter((entry) => entry.id !== position.id),
      position,
    ],
    updatedAt: nowIso(),
  };
}

export function derivePerpMark(
  state: ComputePriceMarketState,
  args: {
    resourceClass: ComputePerpContract["resourceClass"];
    region: string;
    tier: string;
  },
) {
  const contract = state.perpContracts
    .filter(
      (entry) =>
        entry.status === "open" &&
        entry.resourceClass === args.resourceClass &&
        entry.region === args.region &&
        entry.tier === args.tier,
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  return contract?.markPrice ?? null;
}

export function deriveForecastPrice(
  state: ComputePriceMarketState,
  args: {
    resourceClass: ComputeForecastQuestion["resourceClass"];
    region: string;
    tier: string;
  },
) {
  const relevantQuestions = state.forecastQuestions.filter(
    (entry) =>
      entry.status === "open" &&
      entry.resourceClass === args.resourceClass &&
      entry.region === args.region &&
      entry.tier === args.tier,
  );

  if (!relevantQuestions.length) {
    return null;
  }

  const thresholds = relevantQuestions.map((question) => {
    const positions = state.forecastPositions.filter(
      (entry) => entry.questionId === question.id,
    );
    const totalStake = positions.reduce((sum, entry) => sum + entry.stake, 0);
    if (!totalStake) {
      return null;
    }

    const weightedYes = positions.reduce((sum, entry) => {
      const probability =
        entry.selection === "yes" ? entry.impliedProbability : 1 - entry.impliedProbability;
      return sum + probability * entry.stake;
    }, 0);

    return {
      thresholdPrice: question.thresholdPrice,
      weight: totalStake,
      yesProbability: weightedYes / totalStake,
    };
  });

  const activeThresholds = thresholds.filter(Boolean) as Array<{
    thresholdPrice: number;
    weight: number;
    yesProbability: number;
  }>;
  if (!activeThresholds.length) {
    return null;
  }

  const weightedExpected = activeThresholds.reduce(
    (sum, entry) => sum + entry.thresholdPrice * entry.yesProbability * entry.weight,
    0,
  );
  const totalWeight = activeThresholds.reduce((sum, entry) => sum + entry.weight, 0);
  return Number((weightedExpected / Math.max(totalWeight, 1)).toFixed(6));
}

export function buildReferenceComputePrice(args: {
  state: ComputePriceMarketState;
  computeMarketState: ComputeMarketState;
  resourceClass: ReferenceComputePrice["resourceClass"];
  region: string;
  tier: string;
}) {
  const computeMarketState = createComputeMarketState(args.computeMarketState);
  const spotIndex = buildSpotIndex({
    region: args.region,
    resourceClass: args.resourceClass,
    state: computeMarketState,
    tier: args.tier,
  });
  const perpMark = derivePerpMark(args.state, args);
  const forecastPrice = deriveForecastPrice(args.state, args);

  let referencePrice = spotIndex;
  let liquidityMode: ReferenceComputePrice["liquidityMode"] = "spot_only";

  if (spotIndex && perpMark && forecastPrice) {
    referencePrice = Number(
      (spotIndex * 0.6 + perpMark * 0.25 + forecastPrice * 0.15).toFixed(6),
    );
    liquidityMode = "full_blend";
  } else if (spotIndex && perpMark) {
    referencePrice = Number((spotIndex * 0.75 + perpMark * 0.25).toFixed(6));
    liquidityMode = "spot_perp";
  } else if (spotIndex && forecastPrice) {
    referencePrice = Number((spotIndex * 0.85 + forecastPrice * 0.15).toFixed(6));
    liquidityMode = "spot_forecast";
  } else if (!spotIndex && perpMark && forecastPrice) {
    referencePrice = Number((perpMark * 0.625 + forecastPrice * 0.375).toFixed(6));
    liquidityMode = "full_blend";
  } else if (!spotIndex && perpMark) {
    referencePrice = perpMark;
    liquidityMode = "spot_perp";
  } else if (!spotIndex && forecastPrice) {
    referencePrice = forecastPrice;
    liquidityMode = "spot_forecast";
  }

  return {
    forecastPrice,
    id: `${args.resourceClass}:${args.region}:${args.tier}`,
    liquidityMode,
    perpMark,
    referencePrice: Number(referencePrice.toFixed(6)),
    region: args.region,
    resourceClass: args.resourceClass,
    spotIndex: Number(spotIndex.toFixed(6)),
    tier: args.tier,
    updatedAt: nowIso(),
  } satisfies ReferenceComputePrice;
}

export function syncReferencePrice(
  state: ComputePriceMarketState,
  computeMarketState: ComputeMarketState,
  args: {
    resourceClass: ReferenceComputePrice["resourceClass"];
    region: string;
    tier: string;
  },
) {
  const referencePrice = buildReferenceComputePrice({
    computeMarketState,
    region: args.region,
    resourceClass: args.resourceClass,
    state,
    tier: args.tier,
  });

  return {
    ...state,
    referencePrices: [
      ...state.referencePrices.filter((entry) => entry.id !== referencePrice.id),
      referencePrice,
    ],
    updatedAt: nowIso(),
  };
}
