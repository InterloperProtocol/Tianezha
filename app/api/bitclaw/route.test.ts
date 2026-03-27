import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guestModule = vi.hoisted(() => ({
  getOrCreateGuestSession: vi.fn(),
}));

const internalAdminModule = vi.hoisted(() => ({
  assertGuestEnabled: vi.fn(),
}));

const bitClawModule = vi.hoisted(() => ({
  createHumanBitClawPost: vi.fn(),
  getBitClawFeed: vi.fn(),
  getViewerBitClawProfile: vi.fn(),
  listViewerAgentBitClawProfiles: vi.fn(),
  listBitClawProfiles: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  assertSameOriginMutation: vi.fn(),
  enforceRequestRateLimit: vi.fn(),
  getRateLimitRetryAfterSeconds: vi.fn(),
}));

vi.mock("@/lib/server/guest", () => guestModule);
vi.mock("@/lib/server/internal-admin", () => internalAdminModule);
vi.mock("@/lib/server/bitclaw", () => bitClawModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/bitclaw/route";

describe("/api/bitclaw POST", () => {
  beforeEach(() => {
    guestModule.getOrCreateGuestSession.mockReset();
    internalAdminModule.assertGuestEnabled.mockReset();
    bitClawModule.createHumanBitClawPost.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("rejects image posts from the public human route", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });

    const request = new NextRequest("https://example.com/api/bitclaw", {
      method: "POST",
      body: JSON.stringify({
        handle: "human-one",
        displayName: "Human One",
        body: "hello",
        imageUrl: "https://example.com/image.png",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Public BitClaw posting is text-only. Agent images must use the API.");
    expect(bitClawModule.createHumanBitClawPost).not.toHaveBeenCalled();
  });

  it("publishes a text post for the guest session", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });
    bitClawModule.createHumanBitClawPost.mockResolvedValue({
      id: "post-1",
    });

    const request = new NextRequest("https://example.com/api/bitclaw", {
      method: "POST",
      body: JSON.stringify({
        handle: "human-one",
        displayName: "Human One",
        bio: "bio",
        body: "hello",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(bitClawModule.createHumanBitClawPost).toHaveBeenCalledWith({
      guestId: "guest-1",
      handle: "human-one",
      displayName: "Human One",
      bio: "bio",
      avatarUrl: undefined,
      body: "hello",
    });
    expect(payload.item?.id).toBe("post-1");
  });

  it("rejects agent posting on the public route", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });

    const request = new NextRequest("https://example.com/api/bitclaw", {
      method: "POST",
      body: JSON.stringify({
        authorType: "agent",
        handle: "agent-one",
        displayName: "Agent One",
        bio: "agent bio",
        body: "autonomous hello",
        imageUrl: "https://example.com/agent.png",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe(
      "Agent signup and posting now require the BitClaw API. Use /api/bitclaw/agents/register and post with a Bearer API key.",
    );
    expect(bitClawModule.createHumanBitClawPost).not.toHaveBeenCalled();
  });

  it("does not call the human writer when the request carries image data", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });

    const request = new NextRequest("https://example.com/api/bitclaw", {
      method: "POST",
      body: JSON.stringify({
        handle: "human-one",
        displayName: "Human One",
        body: "hello",
        imageUrl: "https://example.com/agent.png",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(bitClawModule.createHumanBitClawPost).not.toHaveBeenCalled();
  });
});
