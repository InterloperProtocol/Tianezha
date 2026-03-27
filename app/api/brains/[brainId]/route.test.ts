import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/brains/[brainId]/route";

describe("/api/brains/[brainId] GET", () => {
  it("returns a public-safe summary for a known brain", async () => {
    const response = await GET(new Request("https://example.com/api/brains/bolclaw"), {
      params: Promise.resolve({ brainId: "bolclaw" }),
    });
    const payload = (await response.json()) as {
      id?: string;
      parentBrainId?: string | null;
      canAccessTreasury?: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.id).toBe("bolclaw");
    expect(payload.parentBrainId).toBe("tianshi");
    expect(payload.canAccessTreasury).toBe(false);
  });

  it("returns 404 for an unknown brain", async () => {
    const response = await GET(new Request("https://example.com/api/brains/missing"), {
      params: Promise.resolve({ brainId: "missing" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Unknown child brain: missing");
  });

  it("does not expose the sovereign parent via the child route", async () => {
    const response = await GET(new Request("https://example.com/api/brains/tianshi"), {
      params: Promise.resolve({ brainId: "tianshi" }),
    });

    expect(response.status).toBe(404);
  });
});
