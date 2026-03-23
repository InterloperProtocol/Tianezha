import type { Lamports } from "@/lib/types/constitution";
import {
  CHILD_EXECUTION_RULE,
  type ChildBrainAction,
  type ChildBrainProposal,
} from "@/lib/types/brains";
import { getChildBrainById } from "@/lib/brains/registry";
import { createAuditEvent } from "@/workers/audit-log";
import { assertParentBrainExecutionAuthority } from "@/workers/security-guards";

function assertChildBrainCanPerform(args: {
  brainId: string;
  action: ChildBrainAction;
}) {
  const brain = getChildBrainById(args.brainId);
  if (!brain) {
    throw new Error(`Unknown constitutional child brain: ${args.brainId}`);
  }

  const allowed =
    (args.action === "publish_post" && brain.canPost) ||
    (args.action === "publish_thesis" && brain.canPublishThesis) ||
    ((args.action === "surface_wallet_intel" ||
      args.action === "request_wallet_watchlist") &&
      brain.canSurfaceWalletIntel) ||
    (args.action === "request_trade" && brain.canRequestTrades) ||
    ((args.action === "sell_billboard" ||
      args.action === "request_billboard_action") &&
      brain.canSellBillboards) ||
    (args.action === "request_treasury_action" && brain.canRequestTrades) ||
    (args.action === "operate_livestream" && brain.canOperateLivestream);

  if (!allowed) {
    throw new Error(
      `${brain.displayName} is not constitutionally allowed to ${args.action}.`,
    );
  }

  return brain;
}

export function createChildBrainProposal(args: {
  brainId: string;
  action: ChildBrainAction;
  rationale: string;
  requestedLamports?: Lamports;
  metadata?: Readonly<Record<string, unknown>>;
  requestedAtMs?: number;
}) {
  // Children may think locally, but only the parent executes globally.
  const brain = assertChildBrainCanPerform({
    brainId: args.brainId,
    action: args.action,
  });
  const requestedAtMs = args.requestedAtMs ?? Date.now();

  const proposal: ChildBrainProposal = {
    childBrainId: brain.id as ChildBrainProposal["childBrainId"],
    parentBrainId: "goonclaw",
    action: args.action,
    rationale: args.rationale,
    requestedAtMs,
    requestedLamports: args.requestedLamports?.toString(10),
    executionRule: CHILD_EXECUTION_RULE,
    status: "forwarded_to_parent",
    metadata: args.metadata,
  };

  return {
    proposal,
    auditEvent: createAuditEvent({
      type: "CHILD_PROPOSAL_RECEIVED",
      actor: "CHILD_BRAIN_GATEWAY",
      atMs: requestedAtMs,
      metadata: {
        childBrainId: proposal.childBrainId,
        parentBrainId: proposal.parentBrainId,
        action: proposal.action,
        requestedLamports: proposal.requestedLamports,
        ...args.metadata,
      },
    }),
  };
}

export function assertSovereignParentGlobalExecution(actingBrainId: string) {
  assertParentBrainExecutionAuthority({ actingBrainId });
}

export function escalateChildBrainProposal(
  proposal: ChildBrainProposal,
  escalatedAtMs = Date.now(),
) {
  return {
    proposal,
    auditEvent: createAuditEvent({
      type: "CHILD_PROPOSAL_ESCALATED",
      actor: "CHILD_BRAIN_GATEWAY",
      atMs: escalatedAtMs,
      metadata: {
        childBrainId: proposal.childBrainId,
        parentBrainId: proposal.parentBrainId,
        action: proposal.action,
      },
    }),
  };
}
