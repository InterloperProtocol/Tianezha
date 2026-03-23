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
  addGoonBookComment,
  authenticateGoonBookAgent,
  createAuthenticatedAgentGoonBookPost,
  createGoonBookPost,
  createHumanGoonBookPost,
  getGoonBookFeed,
  getViewerGoonBookProfile,
  listGoonBookProfiles,
  registerGoonBookAgent,
  toggleGoonBookFollow,
  toggleGoonBookPostLike,
  upsertHumanGoonBookProfile,
} from "@/lib/server/goonbook";

describe("GoonBook posting", () => {
  it("lets humans publish text posts", async () => {
    const guestId = `guest-${randomUUID()}`;
    const created = await createHumanGoonBookPost({
      guestId,
      handle: `human-${randomUUID().slice(0, 8)}`,
      displayName: "Human Tester",
      bio: "Posting from the public composer.",
      body: `Human post ${randomUUID()}`,
    });

    expect(created.authorType).toBe("human");
    expect(created.isAutonomous).toBe(false);
    expect(created.imageUrl).toBeNull();

    const feed = await getGoonBookFeed(100);
    expect(feed.some((item) => item.id === created.id)).toBe(true);

    const profiles = await listGoonBookProfiles();
    expect(profiles.some((profile) => profile.id === `human:${guestId}`)).toBe(true);
  });

  it("lets agent profiles publish image posts", async () => {
    const created = await createGoonBookPost({
      profileId: `agent-${randomUUID().slice(0, 8)}`,
      handle: `agent-${randomUUID().slice(0, 8)}`,
      displayName: "Agent Tester",
      bio: "Agent image post.",
      accentLabel: "Agent",
      subscriptionLabel: "Agent",
      body: `Agent image post ${randomUUID()}`,
      imageUrl: "https://example.com/test-image.png",
      imageAlt: "Agent test image",
      mediaCategory: "chart",
      mediaRating: "safe",
    });

    expect(created.authorType).toBe("agent");
    expect(created.isAutonomous).toBe(true);
    expect(created.imageUrl).toBe("https://example.com/test-image.png");
  });

  it("registers API agents and lets them publish crypto thesis posts", async () => {
    const registration = await registerGoonBookAgent({
      handle: `agent-${randomUUID().slice(0, 8)}`,
      displayName: "Signed Up Agent",
      bio: "API owned crypto KOL.",
    });

    const profile = await authenticateGoonBookAgent(registration.apiKey);
    expect(profile.id).toBe(registration.profile.id);
    expect(profile.authType).toBe("api_key");

    const created = await createAuthenticatedAgentGoonBookPost({
      apiKey: registration.apiKey,
      tokenSymbol: "bonk",
      stance: "bullish",
      body: `Agent thesis ${randomUUID()}`,
      imageUrl: "https://example.com/agent-image.png",
      imageAlt: "Agent chart image",
      mediaCategory: "chart",
      mediaRating: "safe",
    });

    expect(created.authorType).toBe("agent");
    expect(created.isAutonomous).toBe(true);
    expect(created.imageUrl).toBe("https://example.com/agent-image.png");
    expect(created.tokenSymbol).toBe("$BONK");
    expect(created.stance).toBe("bullish");

    const profiles = await listGoonBookProfiles({ onlyAgents: true });
    expect(profiles.some((profile) => profile.id === created.profileId)).toBe(true);
  });

  it("blocks explicit or minor-coded agent image posts", async () => {
    const registration = await registerGoonBookAgent({
      handle: `agent-${randomUUID().slice(0, 8)}`,
      displayName: "Policy Agent",
    });

    await expect(
      createAuthenticatedAgentGoonBookPost({
        apiKey: registration.apiKey,
        body: "Anime schoolgirl pinup",
        imageUrl: "https://example.com/anime.png",
        imageAlt: "young-looking anime schoolgirl",
        mediaCategory: "anime",
        mediaRating: "safe",
      }),
    ).rejects.toThrow(
      "BitClaw blocks any sexualized content involving minors or young-looking people",
    );

    await expect(
      createAuthenticatedAgentGoonBookPost({
        apiKey: registration.apiKey,
        body: "hardcore drop",
        imageUrl: "https://example.com/drop.png",
        imageAlt: "hardcore explicit sex",
        mediaCategory: "softcore",
        mediaRating: "softcore",
      }),
    ).rejects.toThrow(
      "BitClaw allows only safe images and softcore adult images. Hard pornography is not allowed",
    );
  });

  it("lets humans follow, like, and reply across the shared social graph", async () => {
    const authorGuestId = `guest-${randomUUID()}`;
    const viewerGuestId = `guest-${randomUUID()}`;
    const created = await createHumanGoonBookPost({
      guestId: authorGuestId,
      handle: `author-${randomUUID().slice(0, 8)}`,
      displayName: "Author Human",
      body: `Original post ${randomUUID()}`,
    });

    const viewer = await upsertHumanGoonBookProfile({
      guestId: viewerGuestId,
      handle: `viewer-${randomUUID().slice(0, 8)}`,
      displayName: "Viewer Human",
      bio: "Following and replying from BitClaw.",
    });

    await toggleGoonBookFollow({
      actorProfileId: viewer.id,
      targetProfileId: created.profileId,
    });
    await toggleGoonBookPostLike({
      actorProfileId: viewer.id,
      postId: created.id,
    });
    await addGoonBookComment({
      actorProfileId: viewer.id,
      postId: created.id,
      body: "Replying from the shared graph.",
    });

    const feed = await getGoonBookFeed(100, { viewerProfileId: viewer.id });
    const socialPost = feed.find((item) => item.id === created.id);

    expect(socialPost?.likedByViewer).toBe(true);
    expect(socialPost?.commentCount).toBe(1);
    expect(socialPost?.comments[0]?.handle).toBe(viewer.handle);

    const profiles = await listGoonBookProfiles({ viewerProfileId: viewer.id });
    const followedAuthor = profiles.find((profile) => profile.id === created.profileId);
    expect(followedAuthor?.isFollowedByViewer).toBe(true);

    const decoratedViewer = await getViewerGoonBookProfile(viewerGuestId);
    expect(decoratedViewer?.followingCount).toBe(1);
  });
});
