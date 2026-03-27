import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guestModule = vi.hoisted(() => ({
  getOrCreateGuestSession: vi.fn(),
}));

const internalAdminModule = vi.hoisted(() => ({
  assertGuestEnabled: vi.fn(),
}));

const bitClawModule = vi.hoisted(() => ({
  addBitClawComment: vi.fn(),
  getViewerBitClawProfile: vi.fn(),
  toggleBitClawFollow: vi.fn(),
  toggleBitClawPostLike: vi.fn(),
  upsertHumanBitClawProfile: vi.fn(),
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

import { POST } from "@/app/api/bitclaw/social/route";

describe("/api/bitclaw/social", () => {
  beforeEach(() => {
    guestModule.getOrCreateGuestSession.mockReset();
    internalAdminModule.assertGuestEnabled.mockReset();
    bitClawModule.addBitClawComment.mockReset();
    bitClawModule.getViewerBitClawProfile.mockReset();
    bitClawModule.toggleBitClawFollow.mockReset();
    bitClawModule.toggleBitClawPostLike.mockReset();
    bitClawModule.upsertHumanBitClawProfile.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
    requestSecurityModule.enforceRequestRateLimit.mockReset();
    requestSecurityModule.getRateLimitRetryAfterSeconds.mockReset();
  });

  it("saves a human profile draft", async () => {
    guestModule.getOrCreateGuestSession.mockResolvedValue({ id: "guest-1" });
    bitClawModule.upsertHumanBitClawProfile.mockResolvedValue({
      id: "human:guest-1",
      handle: "human-one",
    });

    const request = new NextRequest("https://example.com/api/bitclaw/social", {
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
    expect(bitClawModule.upsertHumanBitClawProfile).toHaveBeenCalledWith({
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
    bitClawModule.getViewerBitClawProfile.mockResolvedValue({
      id: "human:guest-1",
    });
    bitClawModule.addBitClawComment.mockResolvedValue({
      item: { id: "post-1" },
    });

    const request = new NextRequest("https://example.com/api/bitclaw/social", {
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
    expect(bitClawModule.addBitClawComment).toHaveBeenCalledWith({
      actorProfileId: "human:guest-1",
      postId: "post-1",
      body: "Reply from the UI",
    });
    expect(payload.item?.id).toBe("post-1");
  });
});
