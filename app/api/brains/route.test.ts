import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/brains/route";

describe("/api/brains GET", () => {
  it("returns child brain summaries only", async () => {
    const response = await GET();
    const payload = (await response.json()) as {
      parentBrainId?: string;
      count?: number;
      brains?: Array<{ id?: string; canTradeDirectly?: boolean }>;
    };

    expect(response.status).toBe(200);
    expect(payload.parentBrainId).toBe("tianshi");
    expect(payload.count).toBe(3);
    expect(payload.brains?.map((brain) => brain.id)).toEqual([
      "bolclaw",
      "trenchstroker",
      "outoforder",
    ]);
    expect(payload.brains?.every((brain) => brain.canTradeDirectly === false)).toBe(
      true,
    );
  });
});
