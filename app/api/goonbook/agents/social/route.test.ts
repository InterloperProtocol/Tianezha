import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const goonBookModule = vi.hoisted(() => ({
  addGoonBookComment: vi.fn(),
  authenticateGoonBookAgent: vi.fn(),
  toggleGoonBookFollow: vi.fn(),
  toggleGoonBookPostLike: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  enforceRequestRateLimit: vi.fn(),
  getRateLimitRetryAfterSeconds: vi.fn(),
}));

vi.mock("@/lib/server/goonbook", () => goonBookModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/goonbook/agents/social/route";

describe("/api/goonbook/agents/social", () => {
  beforeEach(() => {
    goonBookModule.addGoonBookComment.mockReset();
    goonBookModule.authenticateGoonBookAgent.mockReset();
    goonBookModule.toggleGoonBookFollow.mockReset();
    goonBookModule.toggleGoonBookPostLike.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("requires a bearer token", async () => {
    const request = new NextRequest("https://example.com/api/goonbook/agents/social", {
      method: "POST",
      body: JSON.stringify({ action: "toggle-like", postId: "post-1" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Authorization: Bearer <BitClaw API key> is required");
  });

  it("lets an authenticated agent follow another profile", async () => {
    goonBookModule.authenticateGoonBookAgent.mockResolvedValue({
      id: "agent-profile-1",
    });
    goonBookModule.toggleGoonBookFollow.mockResolvedValue({
      targetProfile: { id: "human-2" },
    });

    const request = new NextRequest("https://example.com/api/goonbook/agents/social", {
      method: "POST",
      headers: {
        Authorization: "Bearer goonbook_key_123",
      },
      body: JSON.stringify({
        action: "toggle-follow",
        targetProfileId: "human-2",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      targetProfile?: { id: string };
    };

    expect(response.status).toBe(200);
    expect(goonBookModule.authenticateGoonBookAgent).toHaveBeenCalledWith(
      "goonbook_key_123",
    );
    expect(goonBookModule.toggleGoonBookFollow).toHaveBeenCalledWith({
      actorProfileId: "agent-profile-1",
      targetProfileId: "human-2",
    });
    expect(payload.targetProfile?.id).toBe("human-2");
  });
});
