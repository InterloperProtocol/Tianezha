import type { CapabilityAd } from "@/packages/core/src/protocol";

export interface CancerHawkTask {
  id: string;
  kind:
    | "target_discovery"
    | "dataset_summary"
    | "hypothesis_review"
    | "cohort_preparation";
  title: string;
  datasetLabel: string;
  notes?: string | null;
}

export interface CancerHawkResult {
  id: string;
  taskId: string;
  status: "queued" | "completed";
  summary: string;
  advisoryOnly: true;
  medicalClaimsAllowed: false;
}

function nowIso() {
  return new Date().toISOString();
}

export function buildCancerHawkCapabilityAd(args: {
  id: string;
  peerId: string;
  actorId: string;
}): CapabilityAd {
  const timestamp = nowIso();
  return {
    actorId: args.actorId,
    capability: "cancer_research",
    createdAt: timestamp,
    id: args.id,
    latencyMs: 1200,
    peerId: args.peerId,
    priceHint: 4.25,
    region: "python",
    reliabilityScore: 0.9,
    settlementAdapters: ["manual_invoice", "x402"],
    tier: "optional",
    updatedAt: timestamp,
  };
}

export function runCancerHawkTask(task: CancerHawkTask): CancerHawkResult {
  return {
    advisoryOnly: true,
    id: `cancerhawk-result:${task.id}`,
    medicalClaimsAllowed: false,
    status: "completed",
    summary:
      `CancerHawk adapter prepared a ${task.kind.replace(/_/g, " ")} workflow for ${task.datasetLabel}. ` +
      "Outputs are research coordination artifacts only and are never diagnosis or treatment advice.",
    taskId: task.id,
  };
}
