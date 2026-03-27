import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const autonomousAgentModule = vi.hoisted(() => ({
  publishAutonomousBitClawPost: vi.fn(),
}));

const bitClawModule = vi.hoisted(() => ({
  createBitClawPost: vi.fn(),
}));

const internalAdminModule = vi.hoisted(() => ({
  requireInternalAdminSession: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  assertSameOriginMutation: vi.fn(),
}));

vi.mock("@/lib/server/autonomous-agent", () => autonomousAgentModule);
vi.mock("@/lib/server/bitclaw", () => bitClawModule);
vi.mock("@/lib/server/internal-admin", () => internalAdminModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/internal-admin/bitclaw/posts/route";

describe("/api/internal-admin/bitclaw/posts", () => {
  beforeEach(() => {
    autonomousAgentModule.publishAutonomousBitClawPost.mockReset();
    bitClawModule.createBitClawPost.mockReset();
    internalAdminModule.requireInternalAdminSession.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
  });

  it("routes Tianshi posts through the autonomous runtime helper", async () => {
    autonomousAgentModule.publishAutonomousBitClawPost.mockResolvedValue({
      post: { id: "post-1" },
    });

    const request = new NextRequest("https://example.com/api/internal-admin/bitclaw/posts", {
      method: "POST",
      body: JSON.stringify({
        agentId: "tianshi",
        body: "Rotation note",
        imageUrl: "https://example.com/chart.png",
        imageAlt: "Chart",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(autonomousAgentModule.publishAutonomousBitClawPost).toHaveBeenCalledWith({
      body: "Rotation note",
      tokenSymbol: undefined,
      stance: undefined,
      imageAlt: "Chart",
      imageUrl: "https://example.com/chart.png",
      mediaCategory: undefined,
      mediaRating: undefined,
      latestPolicyDecision: "Published a first-party BitClaw post from Amber Vault.",
      eventTitle: "Amber Vault published a Tianshi post",
      eventDetail: "Rotation note",
      rawTrace: ["source=amber-vault"],
    });
    expect(bitClawModule.createBitClawPost).not.toHaveBeenCalled();
    expect(payload.item?.id).toBe("post-1");
  });

  it("keeps non-Tianshi posts on the generic BitClaw writer", async () => {
    bitClawModule.createBitClawPost.mockResolvedValue({
      id: "post-2",
    });

    const request = new NextRequest("https://example.com/api/internal-admin/bitclaw/posts", {
      method: "POST",
      body: JSON.stringify({
        profileId: "agent-alpha",
        handle: "agent-alpha",
        displayName: "Agent Alpha",
        body: "Thesis note",
        tokenSymbol: "$BONK",
        stance: "bullish",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(bitClawModule.createBitClawPost).toHaveBeenCalledWith({
      agentId: undefined,
      profileId: "agent-alpha",
      handle: "agent-alpha",
      displayName: "Agent Alpha",
      bio: undefined,
      avatarUrl: undefined,
      accentLabel: undefined,
      subscriptionLabel: undefined,
      body: "Thesis note",
      tokenSymbol: "$BONK",
      stance: "bullish",
      imageAlt: undefined,
      imageUrl: undefined,
      mediaCategory: undefined,
      mediaRating: undefined,
    });
    expect(autonomousAgentModule.publishAutonomousBitClawPost).not.toHaveBeenCalled();
    expect(payload.item?.id).toBe("post-2");
  });
});
