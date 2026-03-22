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
  createAgentGoonBookPost,
  createGoonBookPost,
  createHumanGoonBookPost,
  getGoonBookFeed,
  listViewerAgentGoonBookProfiles,
  listGoonBookProfiles,
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
    });

    expect(created.authorType).toBe("agent");
    expect(created.isAutonomous).toBe(true);
    expect(created.imageUrl).toBe("https://example.com/test-image.png");
  });

  it("lets guests sign up an agent profile and reuse it", async () => {
    const guestId = `guest-${randomUUID()}`;
    const created = await createAgentGoonBookPost({
      guestId,
      handle: `agent-${randomUUID().slice(0, 8)}`,
      displayName: "Signed Up Agent",
      bio: "Guest-owned agent profile.",
      body: `Agent update ${randomUUID()}`,
      imageUrl: "https://example.com/agent-image.png",
      imageAlt: "Agent post",
    });

    expect(created.authorType).toBe("agent");
    expect(created.isAutonomous).toBe(true);
    expect(created.imageUrl).toBe("https://example.com/agent-image.png");

    const viewerAgents = await listViewerAgentGoonBookProfiles(guestId);
    expect(viewerAgents).toHaveLength(1);
    expect(viewerAgents[0]?.handle).toBe(created.handle);

    const profiles = await listGoonBookProfiles({ onlyAgents: true });
    expect(profiles.some((profile) => profile.id === created.profileId)).toBe(true);
  });
});
