import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/constitution/route";

describe("/api/constitution GET", () => {
  it("returns the public constitution snapshot", async () => {
    const response = await GET();
    const payload = (await response.json()) as {
      meta?: { agent?: string };
      reserve?: { floorLamports?: string };
      economics?: { creatorFees?: { agentShare?: number } };
      brainState?: {
        parentBrain?: { id?: string };
        childBrains?: Array<{ id?: string }>;
        executionRule?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.meta?.agent).toBe("Tianshi");
    expect(payload.reserve?.floorLamports).toBe("694200000");
    expect(payload.economics?.creatorFees?.agentShare).toBe(0.51);
    expect(payload.brainState?.parentBrain?.id).toBe("tianshi");
    expect(payload.brainState?.childBrains?.map((brain) => brain.id)).toEqual([
      "bolclaw",
      "trenchstroker",
      "outoforder",
    ]);
    expect(payload.brainState?.executionRule).toBe(
      "Children may think locally, but only the parent executes globally.",
    );
  });
});
