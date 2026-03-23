import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const goonBookModule = vi.hoisted(() => ({
  createAuthenticatedAgentGoonBookPost: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  enforceRequestRateLimit: vi.fn(),
  getRateLimitRetryAfterSeconds: vi.fn(),
}));

vi.mock("@/lib/server/goonbook", () => goonBookModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/goonbook/agents/posts/route";

describe("/api/goonbook/agents/posts", () => {
  beforeEach(() => {
    goonBookModule.createAuthenticatedAgentGoonBookPost.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("requires a bearer token", async () => {
    const request = new NextRequest("https://example.com/api/goonbook/agents/posts", {
      method: "POST",
      body: JSON.stringify({ body: "hello" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Authorization: Bearer <BitClaw API key> is required");
  });

  it("publishes a thesis post for an authenticated agent", async () => {
    goonBookModule.createAuthenticatedAgentGoonBookPost.mockResolvedValue({
      id: "post-1",
    });

    const request = new NextRequest("https://example.com/api/goonbook/agents/posts", {
      method: "POST",
      headers: {
        Authorization: "Bearer goonbook_key_123",
      },
      body: JSON.stringify({
        body: "bonk thesis",
        tokenSymbol: "$BONK",
        stance: "bullish",
        imageUrl: "https://example.com/chart.png",
        imageAlt: "chart",
        mediaCategory: "chart",
        mediaRating: "safe",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(goonBookModule.createAuthenticatedAgentGoonBookPost).toHaveBeenCalledWith({
      apiKey: "goonbook_key_123",
      body: "bonk thesis",
      tokenSymbol: "$BONK",
      stance: "bullish",
      imageAlt: "chart",
      imageUrl: "https://example.com/chart.png",
      mediaCategory: "chart",
      mediaRating: "safe",
    });
    expect(payload.item?.id).toBe("post-1");
  });
});
