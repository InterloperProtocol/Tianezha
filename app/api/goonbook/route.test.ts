import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guestModule = vi.hoisted(() => ({
  getOrCreateGuestSession: vi.fn(),
}));

const internalAdminModule = vi.hoisted(() => ({
  assertGuestEnabled: vi.fn(),
}));

const goonBookModule = vi.hoisted(() => ({
  createAgentGoonBookPost: vi.fn(),
  createHumanGoonBookPost: vi.fn(),
  getGoonBookFeed: vi.fn(),
  getViewerGoonBookProfile: vi.fn(),
  listViewerAgentGoonBookProfiles: vi.fn(),
  listGoonBookProfiles: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  assertSameOriginMutation: vi.fn(),
  enforceRequestRateLimit: vi.fn(),
  getRateLimitRetryAfterSeconds: vi.fn(),
}));

vi.mock("@/lib/server/guest", () => guestModule);
vi.mock("@/lib/server/internal-admin", () => internalAdminModule);
vi.mock("@/lib/server/goonbook", () => goonBookModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/goonbook/route";

describe("/api/goonbook POST", () => {
  beforeEach(() => {
    guestModule.getOrCreateGuestSession.mockReset();
    internalAdminModule.assertGuestEnabled.mockReset();
    goonBookModule.createAgentGoonBookPost.mockReset();
    goonBookModule.createHumanGoonBookPost.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("rejects image posts from the public human route", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });

    const request = new NextRequest("https://example.com/api/goonbook", {
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
    expect(payload.error).toBe("Only agent profiles can post images");
    expect(goonBookModule.createHumanGoonBookPost).not.toHaveBeenCalled();
  });

  it("publishes a text post for the guest session", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });
    goonBookModule.createHumanGoonBookPost.mockResolvedValue({
      id: "post-1",
    });

    const request = new NextRequest("https://example.com/api/goonbook", {
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
    expect(goonBookModule.createHumanGoonBookPost).toHaveBeenCalledWith({
      guestId: "guest-1",
      handle: "human-one",
      displayName: "Human One",
      bio: "bio",
      avatarUrl: undefined,
      body: "hello",
    });
    expect(payload.item?.id).toBe("post-1");
  });

  it("publishes an agent post for the guest session", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });
    goonBookModule.createAgentGoonBookPost.mockResolvedValue({
      id: "agent-post-1",
    });

    const request = new NextRequest("https://example.com/api/goonbook", {
      method: "POST",
      body: JSON.stringify({
        authorType: "agent",
        handle: "agent-one",
        displayName: "Agent One",
        bio: "agent bio",
        body: "autonomous hello",
        imageUrl: "https://example.com/agent.png",
        imageAlt: "agent image",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(goonBookModule.createAgentGoonBookPost).toHaveBeenCalledWith({
      guestId: "guest-1",
      profileId: undefined,
      handle: "agent-one",
      displayName: "Agent One",
      bio: "agent bio",
      avatarUrl: undefined,
      body: "autonomous hello",
      imageAlt: "agent image",
      imageUrl: "https://example.com/agent.png",
    });
    expect(payload.item?.id).toBe("agent-post-1");
  });
});
