import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guestModule = vi.hoisted(() => ({
  getOrCreateGuestSession: vi.fn(),
}));

const internalAdminModule = vi.hoisted(() => ({
  assertGuestEnabled: vi.fn(),
}));

const goonBookModule = vi.hoisted(() => ({
  addGoonBookComment: vi.fn(),
  getViewerGoonBookProfile: vi.fn(),
  toggleGoonBookFollow: vi.fn(),
  toggleGoonBookPostLike: vi.fn(),
  upsertHumanGoonBookProfile: vi.fn(),
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

import { POST } from "@/app/api/goonbook/social/route";

describe("/api/goonbook/social", () => {
  beforeEach(() => {
    guestModule.getOrCreateGuestSession.mockReset();
    internalAdminModule.assertGuestEnabled.mockReset();
    goonBookModule.addGoonBookComment.mockReset();
    goonBookModule.getViewerGoonBookProfile.mockReset();
    goonBookModule.toggleGoonBookFollow.mockReset();
    goonBookModule.toggleGoonBookPostLike.mockReset();
    goonBookModule.upsertHumanGoonBookProfile.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("saves a human profile draft", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });
    goonBookModule.upsertHumanGoonBookProfile.mockResolvedValue({
      id: "human:guest-1",
      handle: "human-one",
    });

    const request = new NextRequest("https://example.com/api/goonbook/social", {
      method: "POST",
      body: JSON.stringify({
        action: "upsert-profile",
        handle: "human-one",
        displayName: "Human One",
        bio: "Saving profile",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { profile?: { id: string } };

    expect(response.status).toBe(200);
    expect(goonBookModule.upsertHumanGoonBookProfile).toHaveBeenCalledWith({
      guestId: "guest-1",
      handle: "human-one",
      displayName: "Human One",
      bio: "Saving profile",
      avatarUrl: undefined,
    });
    expect(payload.profile?.id).toBe("human:guest-1");
  });

  it("publishes a comment for the saved viewer profile", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });
    goonBookModule.getViewerGoonBookProfile.mockResolvedValue({
      id: "human:guest-1",
    });
    goonBookModule.addGoonBookComment.mockResolvedValue({
      item: { id: "post-1" },
    });

    const request = new NextRequest("https://example.com/api/goonbook/social", {
      method: "POST",
      body: JSON.stringify({
        action: "comment",
        postId: "post-1",
        body: "Reply from the UI",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { item?: { id: string } };

    expect(response.status).toBe(200);
    expect(goonBookModule.addGoonBookComment).toHaveBeenCalledWith({
      actorProfileId: "human:guest-1",
      postId: "post-1",
      body: "Reply from the UI",
    });
    expect(payload.item?.id).toBe("post-1");
  });
});
