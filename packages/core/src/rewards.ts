import type {
  RewardEntry,
  RewardEntryKind,
  RewardLedgerState,
  RewardPoolPolicy,
} from "@/packages/core/src/protocol";
import { DEFAULT_REWARD_POOL_POLICY, validateRewardPoolPolicy } from "@/packages/core/src/community";

function nowIso() {
  return new Date().toISOString();
}

export function createRewardLedgerState(
  policy: RewardPoolPolicy = DEFAULT_REWARD_POOL_POLICY,
  entries: RewardEntry[] = [],
): RewardLedgerState {
  return {
    entries,
    id: "tianezha-reward-ledger",
    policy: validateRewardPoolPolicy(policy),
    updatedAt: nowIso(),
  };
}

export function recordRewardEntry(
  state: RewardLedgerState,
  entry: RewardEntry,
): RewardLedgerState {
  return {
    ...state,
    entries: [...state.entries, entry].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    ),
    updatedAt: nowIso(),
  };
}

export function createRewardEntry(args: {
  id: string;
  actorId: string;
  kind: RewardEntryKind;
  amount: number;
  rewardClass: RewardEntry["rewardClass"];
  reason: string;
  referenceId?: string | null;
}) {
  return {
    actorId: args.actorId,
    amount: Number(args.amount.toFixed(6)),
    createdAt: nowIso(),
    id: args.id,
    kind: args.kind,
    reason: args.reason,
    referenceId: args.referenceId ?? null,
    rewardClass: args.rewardClass,
  } satisfies RewardEntry;
}

export function recordProofOfComputeReward(
  state: RewardLedgerState,
  args: {
    id: string;
    actorId: string;
    amount: number;
    rewardClass?: RewardEntry["rewardClass"];
    reason: string;
    referenceId?: string | null;
  },
) {
  return recordRewardEntry(
    state,
    createRewardEntry({
      actorId: args.actorId,
      amount: args.amount,
      id: args.id,
      kind: "proof_of_compute",
      reason: args.reason,
      referenceId: args.referenceId,
      rewardClass: args.rewardClass ?? "simulated",
    }),
  );
}

export function summarizeRewardsByKind(state: RewardLedgerState) {
  return state.entries.reduce<Record<RewardEntryKind, number>>((summary, entry) => {
    summary[entry.kind] = Number(((summary[entry.kind] || 0) + entry.amount).toFixed(6));
    return summary;
  }, {
    in_game: 0,
    participation: 0,
    proof_of_compute: 0,
    proof_of_loss: 0,
    service_sale: 0,
    token_holder_proportional: 0,
  });
}

export function calculateRewardPoolAllocation(
  totalRewardUnits: number,
  policy: RewardPoolPolicy = DEFAULT_REWARD_POOL_POLICY,
) {
  validateRewardPoolPolicy(policy);
  const rewardsPoolUnits = (totalRewardUnits * policy.totalRewardsPoolPct) / 100;
  return {
    proofOfCompute: Number(
      ((rewardsPoolUnits * policy.proofOfComputePct) / 100).toFixed(6),
    ),
    tokenHolderProportional: Number(
      ((rewardsPoolUnits * policy.tokenHolderProportionalPct) / 100).toFixed(6),
    ),
    totalRewardsPool: Number(rewardsPoolUnits.toFixed(6)),
    userRewards: Number(
      ((rewardsPoolUnits * policy.userRewardPct) / 100).toFixed(6),
    ),
  };
}
