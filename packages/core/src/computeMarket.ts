import type {
  ComputeAssignment,
  ComputeBid,
  ComputeCompletion,
  ComputeMarketState,
  ComputeOffer,
  ComputeRequest,
  EvidenceDigestRef,
  SettlementIntent,
} from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

export function createComputeMarketState(
  overrides?: Partial<ComputeMarketState>,
): ComputeMarketState {
  return {
    assignments: overrides?.assignments ?? [],
    bids: overrides?.bids ?? [],
    completions: overrides?.completions ?? [],
    id: overrides?.id ?? "tianezha-compute-market",
    offers: overrides?.offers ?? [],
    requests: overrides?.requests ?? [],
    updatedAt: overrides?.updatedAt ?? nowIso(),
  };
}

export function upsertComputeOffer(
  state: ComputeMarketState,
  offer: ComputeOffer,
): ComputeMarketState {
  return {
    ...state,
    offers: [...state.offers.filter((entry) => entry.id !== offer.id), offer].sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt),
    ),
    updatedAt: nowIso(),
  };
}

export function upsertComputeRequest(
  state: ComputeMarketState,
  request: ComputeRequest,
): ComputeMarketState {
  return {
    ...state,
    requests: [
      ...state.requests.filter((entry) => entry.id !== request.id),
      request,
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    updatedAt: nowIso(),
  };
}

function offerMatchesRequest(offer: ComputeOffer, request: ComputeRequest) {
  if (offer.status !== "open" || request.status !== "open") {
    return false;
  }

  if (offer.resourceClass !== request.resourceClass) {
    return false;
  }

  if (offer.capability !== request.capability) {
    return false;
  }

  if (offer.region !== request.region || offer.tier !== request.tier) {
    return false;
  }

  if (offer.availableUnits < request.requestedUnits) {
    return false;
  }

  if (offer.latencyMs > request.maxLatencyMs) {
    return false;
  }

  if (offer.reliabilityScore < request.minReliabilityScore) {
    return false;
  }

  if (
    typeof request.maxUnitPrice === "number" &&
    Number.isFinite(request.maxUnitPrice) &&
    offer.unitPrice > request.maxUnitPrice
  ) {
    return false;
  }

  return request.settlementAdapters.some((adapter) =>
    offer.settlementAdapters.includes(adapter),
  );
}

export function rankOffersForRequest(
  state: ComputeMarketState,
  request: ComputeRequest,
) {
  return state.offers
    .filter((offer) => offerMatchesRequest(offer, request))
    .sort((left, right) => {
      if (left.unitPrice !== right.unitPrice) {
        return left.unitPrice - right.unitPrice;
      }

      if (left.reliabilityScore !== right.reliabilityScore) {
        return right.reliabilityScore - left.reliabilityScore;
      }

      if (left.latencyMs !== right.latencyMs) {
        return left.latencyMs - right.latencyMs;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });
}

export function submitComputeBid(
  state: ComputeMarketState,
  bid: ComputeBid,
): ComputeMarketState {
  return {
    ...state,
    bids: [...state.bids.filter((entry) => entry.id !== bid.id), bid].sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt),
    ),
    updatedAt: nowIso(),
  };
}

export function assignBestComputeOffer(args: {
  state: ComputeMarketState;
  requestId: string;
  assignmentId: string;
  bidId: string;
  settlementIntent?: SettlementIntent | null;
}) {
  const request = args.state.requests.find((entry) => entry.id === args.requestId);
  if (!request) {
    throw new Error(`Unknown compute request ${args.requestId}.`);
  }

  const rankedOffers = rankOffersForRequest(args.state, request);
  const bestOffer = rankedOffers[0];
  if (!bestOffer) {
    throw new Error(`No open compute offer satisfies request ${args.requestId}.`);
  }

  const bid: ComputeBid = {
    actorId: bestOffer.actorId,
    createdAt: nowIso(),
    id: args.bidId,
    latencyMs: bestOffer.latencyMs,
    offerId: bestOffer.id,
    proposedUnits: request.requestedUnits,
    reliabilityScore: bestOffer.reliabilityScore,
    requestId: request.id,
    settlementAdapter: bestOffer.settlementAdapters.find((adapter) =>
      request.settlementAdapters.includes(adapter),
    )!,
    status: "accepted",
    unitPrice: bestOffer.unitPrice,
    updatedAt: nowIso(),
  };

  const assignment: ComputeAssignment = {
    agreedUnitPrice: bid.unitPrice,
    agreedUnits: bid.proposedUnits,
    bidId: bid.id,
    buyerActorId: request.actorId,
    capability: request.capability,
    createdAt: nowIso(),
    id: args.assignmentId,
    offerId: bestOffer.id,
    region: request.region,
    requestId: request.id,
    resourceClass: request.resourceClass,
    sellerActorId: bestOffer.actorId,
    settlementIntent: args.settlementIntent ?? null,
    status: "assigned",
    tier: request.tier,
    updatedAt: nowIso(),
  };

  return createComputeMarketState({
    ...args.state,
    assignments: [...args.state.assignments, assignment],
    bids: [...args.state.bids.filter((entry) => entry.id !== bid.id), bid],
    offers: args.state.offers.map((offer) =>
      offer.id === bestOffer.id
        ? {
            ...offer,
            availableUnits: Number(
              Math.max(0, offer.availableUnits - request.requestedUnits).toFixed(6),
            ),
            status:
              offer.availableUnits - request.requestedUnits <= 0 ? "filled" : offer.status,
            updatedAt: nowIso(),
          }
        : offer,
    ),
    requests: args.state.requests.map((entry) =>
      entry.id === request.id
        ? { ...entry, status: "assigned", updatedAt: nowIso() }
        : entry,
    ),
  });
}

export function completeComputeAssignment(args: {
  state: ComputeMarketState;
  assignmentId: string;
  completionId: string;
  deliveredUnits: number;
  evidenceDigest?: EvidenceDigestRef | null;
  settlementReceipt?: ComputeCompletion["settlementReceipt"];
  notes?: string | null;
}) {
  const assignment = args.state.assignments.find(
    (entry) => entry.id === args.assignmentId,
  );
  if (!assignment) {
    throw new Error(`Unknown compute assignment ${args.assignmentId}.`);
  }

  const completion: ComputeCompletion = {
    assignmentId: assignment.id,
    buyerRating: null,
    completedAt: nowIso(),
    deliveredUnits: args.deliveredUnits,
    evidenceDigest: args.evidenceDigest ?? null,
    id: args.completionId,
    notes: args.notes ?? null,
    priceCurrency: "USD",
    sellerRating: null,
    settlementReceipt: args.settlementReceipt ?? null,
    totalPrice: Number(
      (assignment.agreedUnitPrice * args.deliveredUnits).toFixed(6),
    ),
  };

  return createComputeMarketState({
    ...args.state,
    assignments: args.state.assignments.map((entry) =>
      entry.id === assignment.id
        ? { ...entry, status: "completed", updatedAt: nowIso() }
        : entry,
    ),
    completions: [...args.state.completions, completion],
    requests: args.state.requests.map((entry) =>
      entry.id === assignment.requestId
        ? { ...entry, status: "completed", updatedAt: nowIso() }
        : entry,
    ),
  });
}

export function buildSpotIndex(args: {
  state: ComputeMarketState;
  resourceClass: ComputeOffer["resourceClass"];
  region: string;
  tier: string;
}) {
  const relevantCompletions = args.state.completions.filter((completion) => {
    const assignment = args.state.assignments.find(
      (entry) => entry.id === completion.assignmentId,
    );
    return (
      assignment?.resourceClass === args.resourceClass &&
      assignment.region === args.region &&
      assignment.tier === args.tier
    );
  });

  const vwapPrice =
    relevantCompletions.reduce((sum, completion) => sum + completion.totalPrice, 0) /
      Math.max(
        1,
        relevantCompletions.reduce(
          (sum, completion) => sum + completion.deliveredUnits,
          0,
        ),
      ) || 0;

  const openBook = args.state.offers
    .filter(
      (offer) =>
        offer.status === "open" &&
        offer.resourceClass === args.resourceClass &&
        offer.region === args.region &&
        offer.tier === args.tier,
    )
    .sort((left, right) => left.unitPrice - right.unitPrice);

  const executableBookPrice = openBook[0]?.unitPrice ?? vwapPrice;
  if (!vwapPrice && !executableBookPrice) {
    return 0;
  }

  if (!vwapPrice) {
    return executableBookPrice;
  }

  if (!executableBookPrice) {
    return vwapPrice;
  }

  return Number((vwapPrice * 0.7 + executableBookPrice * 0.3).toFixed(6));
}
