import type { CapabilityAd } from "@/packages/core/src/protocol";

export interface CancerMarketSignal {
  id: string;
  marketKind:
    | "hypothesis_scoring"
    | "dataset_forecast"
    | "target_prioritization"
    | "research_coordination";
  label: string;
  score: number;
  advisoryOnly: true;
  medicalClaimsAllowed: false;
  createdAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

export function buildCancerPredictionCapabilityAd(args: {
  id: string;
  peerId: string;
  actorId: string;
}): CapabilityAd {
  const timestamp = nowIso();
  return {
    actorId: args.actorId,
    capability: "cancer_prediction_sim",
    createdAt: timestamp,
    id: args.id,
    latencyMs: 900,
    peerId: args.peerId,
    priceHint: 2.75,
    region: "simulation",
    reliabilityScore: 0.88,
    settlementAdapters: ["manual_invoice", "x402"],
    tier: "optional",
    updatedAt: timestamp,
  };
}

export function scoreCancerHypothesis(label: string, confidence: number): CancerMarketSignal {
  return {
    advisoryOnly: true,
    createdAt: nowIso(),
    id: `cancer-signal:${label.toLowerCase().replace(/\s+/g, "-")}`,
    label,
    marketKind: "hypothesis_scoring",
    medicalClaimsAllowed: false,
    score: Number(Math.max(0, Math.min(1, confidence)).toFixed(4)),
  };
}
