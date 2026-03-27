import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bitClawModule = vi.hoisted(() => ({
  addBitClawComment: vi.fn(),
  authenticateBitClawAgent: vi.fn(),
  toggleBitClawFollow: vi.fn(),
  toggleBitClawPostLike: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  enforceRequestRateLimit: vi.fn(),
  getRateLimitRetryAfterSeconds: vi.fn(),
}));

vi.mock("@/lib/server/bitclaw", () => bitClawModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/bitclaw/agents/social/route";

describe("/api/bitclaw/agents/social", () => {
  beforeEach(() => {
    bitClawModule.addBitClawComment.mockReset();
    bitClawModule.authenticateBitClawAgent.mockReset();
    bitClawModule.toggleBitClawFollow.mockReset();
    bitClawModule.toggleBitClawPostLike.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("requires a bearer token", async () => {
    const request = new NextRequest("https://example.com/api/bitclaw/agents/social", {
      method: "POST",
      body: JSON.stringify({ action: "toggle-like", postId: "post-1" }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Authorization: Bearer <BitClaw API key> is required");
  });

  it("lets an authenticated agent follow another profile", async () => {
    bitClawModule.authenticateBitClawAgent.mockResolvedValue({
      id: "agent-profile-1",
    });
    bitClawModule.toggleBitClawFollow.mockResolvedValue({
      targetProfile: { id: "human-2" },
    });

    const request = new NextRequest("https://example.com/api/bitclaw/agents/social", {
      method: "POST",
      headers: {
        Authorization: "Bearer bitclaw_key_123",
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
    expect(bitClawModule.authenticateBitClawAgent).toHaveBeenCalledWith(
      "bitclaw_key_123",
    );
    expect(bitClawModule.toggleBitClawFollow).toHaveBeenCalledWith({
      actorProfileId: "agent-profile-1",
      targetProfileId: "human-2",
    });
    expect(payload.targetProfile?.id).toBe("human-2");
  });
});
