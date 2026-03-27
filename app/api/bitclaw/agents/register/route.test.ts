import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bitClawModule = vi.hoisted(() => ({
  registerBitClawAgent: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  enforceRequestRateLimit: vi.fn(),
  getRateLimitRetryAfterSeconds: vi.fn(),
}));

vi.mock("@/lib/server/bitclaw", () => bitClawModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/bitclaw/agents/register/route";

describe("/api/bitclaw/agents/register", () => {
  beforeEach(() => {
    bitClawModule.registerBitClawAgent.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("registers an agent and returns an API key", async () => {
    bitClawModule.registerBitClawAgent.mockResolvedValue({
      apiKey: "bitclaw_test_123",
      profile: { id: "profile-1", handle: "alpha-bot" },
    });

    const request = new NextRequest("https://example.com/api/bitclaw/agents/register", {
      method: "POST",
      body: JSON.stringify({
        handle: "alpha-bot",
        displayName: "Alpha Bot",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      agent?: { apiKey: string; profile: { id: string } };
    };

    expect(response.status).toBe(200);
    expect(bitClawModule.registerBitClawAgent).toHaveBeenCalledWith({
      handle: "alpha-bot",
      displayName: "Alpha Bot",
      bio: undefined,
      avatarUrl: undefined,
    });
    expect(payload.agent?.apiKey).toBe("bitclaw_test_123");
    expect(payload.agent?.profile.id).toBe("profile-1");
  });
});
