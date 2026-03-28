import type {
  ReservationIntent,
  VendorAssignment,
  VendorCompletion,
  VendorMarketState,
  VendorOffer,
} from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

export function createVendorMarketState(
  overrides?: Partial<VendorMarketState>,
): VendorMarketState {
  return {
    assignments: overrides?.assignments ?? [],
    completions: overrides?.completions ?? [],
    domainOffers: overrides?.domainOffers ?? [],
    id: overrides?.id ?? "tianezha-vendor-market",
    intents: overrides?.intents ?? [],
    offers: overrides?.offers ?? [],
    updatedAt: overrides?.updatedAt ?? nowIso(),
  };
}

export function upsertVendorOffer(
  state: VendorMarketState,
  offer: VendorOffer,
): VendorMarketState {
  return {
    ...state,
    offers: [...state.offers.filter((entry) => entry.id !== offer.id), offer],
    updatedAt: nowIso(),
  };
}

export function createReservationIntent(
  state: VendorMarketState,
  intent: ReservationIntent,
): VendorMarketState {
  return {
    ...state,
    intents: [...state.intents.filter((entry) => entry.id !== intent.id), intent],
    updatedAt: nowIso(),
  };
}

export function assignVendorIntent(args: {
  state: VendorMarketState;
  assignment: VendorAssignment;
}): VendorMarketState {
  return {
    ...args.state,
    assignments: [
      ...args.state.assignments.filter((entry) => entry.id !== args.assignment.id),
      args.assignment,
    ],
    intents: args.state.intents.map((entry) =>
      entry.id === args.assignment.reservationIntentId
        ? { ...entry, status: "assigned" }
        : entry,
    ),
    updatedAt: nowIso(),
  };
}

export function completeVendorAssignment(args: {
  state: VendorMarketState;
  completion: VendorCompletion;
}): VendorMarketState {
  const assignment = args.state.assignments.find(
    (entry) => entry.id === args.completion.assignmentId,
  );
  return {
    ...args.state,
    assignments: args.state.assignments.map((entry) =>
      entry.id === args.completion.assignmentId
        ? { ...entry, status: "completed", updatedAt: nowIso() }
        : entry,
    ),
    completions: [
      ...args.state.completions.filter((entry) => entry.id !== args.completion.id),
      args.completion,
    ],
    intents: args.state.intents.map((entry) =>
      entry.id === assignment?.reservationIntentId
        ? { ...entry, status: "completed" }
        : entry,
    ),
    updatedAt: nowIso(),
  };
}
