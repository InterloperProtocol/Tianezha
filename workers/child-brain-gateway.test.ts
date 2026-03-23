import { describe, expect, it } from "vitest";

import { createChildBrainProposal } from "@/workers/child-brain-gateway";

describe("child brain gateway", () => {
  it("forwards child trade requests to the sovereign parent", () => {
    const { proposal, auditEvent } = createChildBrainProposal({
      brainId: "bolclaw",
      action: "request_trade",
      rationale: "Stream momentum is spiking and needs parent review.",
      requestedLamports: 10_000_000n,
    });

    expect(proposal.parentBrainId).toBe("goonclaw");
    expect(proposal.childBrainId).toBe("bolclaw");
    expect(proposal.requestedLamports).toBe("10000000");
    expect(auditEvent.type).toBe("CHILD_PROPOSAL_RECEIVED");
  });

  it("rejects capabilities a child brain does not own", () => {
    expect(() =>
      createChildBrainProposal({
        brainId: "bolclaw",
        action: "surface_wallet_intel",
        rationale: "Try to access a restricted capability.",
      }),
    ).toThrow(/not constitutionally allowed/i);
  });
});
