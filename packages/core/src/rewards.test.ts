import {
  calculateRewardPoolAllocation,
  createRewardLedgerState,
  recordProofOfComputeReward,
} from "@/packages/core/src/rewards";

describe("rewards", () => {
  it("records proof-of-compute rewards in the ledger", () => {
    const ledger = recordProofOfComputeReward(createRewardLedgerState(), {
      actorId: "actor:tianshi",
      amount: 12.5,
      id: "reward:1",
      reason: "Completed compute job.",
      referenceId: "assignment:1",
    });

    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]?.kind).toBe("proof_of_compute");
    expect(ledger.entries[0]?.amount).toBe(12.5);
  });

  it("keeps the locked 49% pool split", () => {
    const allocation = calculateRewardPoolAllocation(1000);

    expect(allocation.totalRewardsPool).toBe(490);
    expect(allocation.tokenHolderProportional).toBe(249.9);
    expect(allocation.proofOfCompute).toBe(102.9);
    expect(allocation.userRewards).toBe(137.2);
  });
});
