import { randomUUID } from "crypto";

import { CONSTITUTION, assertConstitutionInvariant } from "@/lib/constitution";
import type {
  AuditEvent,
  ConstitutionConfig,
  ReadonlyDeep,
  UnixMs,
} from "@/lib/types/constitution";
import { assertCanonicalStateWriteAuthority } from "@/workers/security-guards";

type ArbitrationParty =
  ConstitutionConfig["arbitrationPolicy"]["actsBetween"][number];

export interface ArbitrationClaim {
  readonly id: string;
  readonly party: ArbitrationParty;
  readonly priority: number;
  readonly timestamp: UnixMs;
  readonly weight: number;
  readonly tieBreakKey: string;
  readonly summary: string;
  readonly requestedResolution?: string;
}

export interface ArbitrationCase {
  readonly disputeId: string;
  readonly title: string;
  readonly claims: ReadonlyArray<ArbitrationClaim>;
}

export interface ArbitrationDecision {
  readonly disputeId: string;
  readonly title: string;
  readonly arbiterBrainId: "goonclaw";
  readonly winningClaim: ArbitrationClaim;
  readonly orderedClaimIds: ReadonlyArray<string>;
  readonly rationale: string;
  readonly auditEvent: AuditEvent;
}

export interface PublicArbiterSummary {
  readonly disputeId: string;
  readonly title: string;
  readonly arbiterBrainId: "goonclaw";
  readonly winningClaimId: string;
  readonly orderedClaimIds: ReadonlyArray<string>;
  readonly rationale: string;
}

export interface RecurringConflictPolicyOutput {
  readonly disputeKey: string;
  readonly conflictCount: number;
  readonly structuralDirective: string;
  readonly prevailingParty: ArbitrationParty;
}

function compareClaims(a: ArbitrationClaim, b: ArbitrationClaim) {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }

  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }

  if (a.weight !== b.weight) {
    return b.weight - a.weight;
  }

  return a.tieBreakKey.localeCompare(b.tieBreakKey);
}

export function orderArbitrationClaims(
  claims: ReadonlyArray<ArbitrationClaim>,
  cfg: ReadonlyDeep<ConstitutionConfig> = CONSTITUTION,
) {
  assertConstitutionInvariant(cfg);
  return [...claims].sort(compareClaims);
}

export function resolveArbitrationCase(
  input: ArbitrationCase,
  cfg: ReadonlyDeep<ConstitutionConfig> = CONSTITUTION,
  actingBrainId = cfg.parentChildPolicy.sovereignParentBrainId,
): ArbitrationDecision {
  assertConstitutionInvariant(cfg);
  assertCanonicalStateWriteAuthority({
    actingBrainId,
    target: "arbitration",
    cfg,
  });

  if (!input.claims.length) {
    throw new Error("Arbitration requires at least one claim.");
  }

  const orderedClaims = orderArbitrationClaims(input.claims, cfg);
  const winningClaim = orderedClaims[0];

  return {
    disputeId: input.disputeId,
    title: input.title,
    arbiterBrainId: "goonclaw",
    winningClaim,
    orderedClaimIds: orderedClaims.map((claim) => claim.id),
    rationale:
      "Claims were ordered by priority, then timestamp, then weight, then lexicographic tie-break key.",
    auditEvent: {
      id: randomUUID(),
      type: "ARBITRATION_DECISION",
      actor: "ARBITER",
      atMs: Date.now(),
      metadata: {
        disputeId: input.disputeId,
        winningClaimId: winningClaim.id,
        orderedClaimIds: orderedClaims.map((claim) => claim.id),
      },
    },
  };
}

export function createDeveloperHolderArbitrationCase(args: {
  disputeId?: string;
  title: string;
  developerSummary: string;
  holderSummary: string;
  timestampMs?: UnixMs;
}) {
  const timestamp = args.timestampMs ?? Date.now();

  return {
    disputeId: args.disputeId ?? `developer-holder-${timestamp}`,
    title: args.title,
    claims: [
      {
        id: `${args.disputeId ?? "developer-holder"}-developer`,
        party: "developer" as const,
        priority: 1,
        timestamp,
        weight: 1,
        tieBreakKey: "developer",
        summary: args.developerSummary,
      },
      {
        id: `${args.disputeId ?? "developer-holder"}-holders`,
        party: "holders" as const,
        priority: 1,
        timestamp,
        weight: 1,
        tieBreakKey: "holders",
        summary: args.holderSummary,
      },
    ],
  } satisfies ArbitrationCase;
}

export function convertRecurringConflictsToPolicyOutput(args: {
  disputeKey: string;
  cases: ReadonlyArray<ArbitrationCase>;
}) {
  if (!args.cases.length) {
    throw new Error("Recurring conflict analysis requires at least one case.");
  }

  const latestDecision = resolveArbitrationCase(args.cases[args.cases.length - 1]);

  return {
    disputeKey: args.disputeKey,
    conflictCount: args.cases.length,
    structuralDirective:
      "Convert repeated disputes into explicit parent-level policy and audit the resulting execution boundary.",
    prevailingParty: latestDecision.winningClaim.party,
  } satisfies RecurringConflictPolicyOutput;
}

export function getPublicArbiterSummary(
  decision: ArbitrationDecision,
): PublicArbiterSummary {
  return {
    disputeId: decision.disputeId,
    title: decision.title,
    arbiterBrainId: decision.arbiterBrainId,
    winningClaimId: decision.winningClaim.id,
    orderedClaimIds: decision.orderedClaimIds,
    rationale: decision.rationale,
  };
}
