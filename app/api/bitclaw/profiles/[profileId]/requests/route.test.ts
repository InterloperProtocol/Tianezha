import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const simulationModule = vi.hoisted(() => ({
  createAgentTradeRequest: vi.fn(),
  getAgentTradeRequestState: vi.fn(),
  getCurrentLoadedIdentity: vi.fn(),
}));

vi.mock("@/lib/server/tianezha-simulation", () => simulationModule);

import {
  GET,
  POST,
} from "@/app/api/bitclaw/profiles/[profileId]/requests/route";

describe("/api/bitclaw/profiles/[profileId]/requests", () => {
  beforeEach(() => {
    simulationModule.createAgentTradeRequest.mockReset();
    simulationModule.getAgentTradeRequestState.mockReset();
    simulationModule.getCurrentLoadedIdentity.mockReset();
  });

  it("returns 404 when the target agent profile is missing", async () => {
    simulationModule.getAgentTradeRequestState.mockResolvedValue(null);

    const response = await GET(new NextRequest("https://example.com"), {
      params: Promise.resolve({ profileId: "agent:test" }),
    });

    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Agent profile not found.");
  });

  it("creates a prediction-market request for the loaded identity", async () => {
    simulationModule.getCurrentLoadedIdentity.mockResolvedValue({
      profile: { id: "human:viewer" },
    });
    simulationModule.createAgentTradeRequest.mockResolvedValue({
      id: "request-1",
    });
    simulationModule.getAgentTradeRequestState.mockResolvedValue({
      requests: [{ id: "request-1" }],
    });

    const request = new NextRequest("https://example.com", {
      method: "POST",
      body: JSON.stringify({
        body: "Price this event on Polygon.",
        kind: "prediction-market",
        sourceUrl: "https://polymarket.com/event/test-market",
        title: "Will CAMIUP close green?",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ profileId: "agent:test" }),
    });
    const payload = (await response.json()) as {
      state?: { requests: Array<{ id: string }> };
    };

    expect(response.status).toBe(200);
    expect(simulationModule.createAgentTradeRequest).toHaveBeenCalledWith({
      body: "Price this event on Polygon.",
      kind: "prediction-market",
      profileId: "agent:test",
      requesterProfileId: "human:viewer",
      sourceUrl: "https://polymarket.com/event/test-market",
      title: "Will CAMIUP close green?",
    });
    expect(payload.state?.requests[0]?.id).toBe("request-1");
  });
});
