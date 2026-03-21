import { randomUUID } from "crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/payload", () => ({
  getPayloadClient: vi.fn(async () => ({
    find: vi.fn(async () => ({ docs: [] })),
    update: vi.fn(),
    create: vi.fn(),
  })),
}));

import {
  createGoonBookPost,
  getGoonBookFeed,
  hideGoonBookPost,
  unhideGoonBookPost,
} from "@/lib/server/goonbook";
import {
  hidePublicStreamProfile,
  unhidePublicStreamProfile,
} from "@/lib/server/internal-admin";
import {
  getPublicStreamPageState,
  listActivePublicStreams,
} from "@/lib/server/public-streams";
import {
  upsertPublicStreamProfile,
  upsertSession,
} from "@/lib/server/repository";
import { nowIso } from "@/lib/utils";

describe("moderation helpers", () => {
  it("hides and restores GoonBook posts without deleting them", async () => {
    const created = await createGoonBookPost({
      body: `Owner moderation test ${randomUUID()}`,
    });

    const hidden = await hideGoonBookPost({
      adminUsername: "owner",
      postId: created.id,
      reason: "Hidden during moderation test.",
    });

    expect(hidden.isHidden).toBe(true);
    expect(hidden.moderatedBy).toBe("owner");
    expect(hidden.moderationReason).toBe("Hidden during moderation test.");

    const publicFeedWhileHidden = await getGoonBookFeed(100);
    expect(publicFeedWhileHidden.some((item) => item.id === created.id)).toBe(false);

    const restored = await unhideGoonBookPost({ postId: created.id });
    expect(restored.isHidden).toBe(false);
    expect(restored.moderatedBy).toBeNull();

    const publicFeedAfterRestore = await getGoonBookFeed(100);
    expect(publicFeedAfterRestore.some((item) => item.id === created.id)).toBe(true);
  });

  it("hides and restores GoonConnect profiles from public listings", async () => {
    const guestId = `guest-${randomUUID()}`;
    const slug = `room-${randomUUID().slice(0, 8)}`;
    const timestamp = nowIso();

    await upsertPublicStreamProfile({
      id: guestId,
      guestId,
      slug,
      isPublic: true,
      defaultContractAddress: `token-${randomUUID()}`,
      mediaUrl: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await upsertSession({
      id: `session-${randomUUID()}`,
      wallet: guestId,
      contractAddress: `contract-${randomUUID()}`,
      deviceId: `device-${randomUUID()}`,
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const visibleBeforeHide = await listActivePublicStreams();
    expect(visibleBeforeHide.some((item) => item.profile.slug === slug)).toBe(true);

    await hidePublicStreamProfile({
      guestId,
      adminUsername: "owner",
      reason: "Hidden during moderation test.",
    });

    const hiddenListing = await listActivePublicStreams();
    expect(hiddenListing.some((item) => item.profile.slug === slug)).toBe(false);
    expect(await getPublicStreamPageState(slug)).toBeNull();

    await unhidePublicStreamProfile({ guestId });

    const visibleAfterRestore = await listActivePublicStreams();
    expect(visibleAfterRestore.some((item) => item.profile.slug === slug)).toBe(true);
  });
});
