import { randomUUID } from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const internalAdminModule = vi.hoisted(() => ({
  isGuestDisabled: vi.fn(),
}));

vi.mock("@/lib/server/internal-admin", () => internalAdminModule);

import {
  getPublicStreamPageState,
  listActivePublicStreams,
} from "@/lib/server/public-streams";
import {
  upsertPublicStreamProfile,
  upsertSession,
} from "@/lib/server/repository";
import { nowIso } from "@/lib/utils";

describe("public streams disabled visibility", () => {
  beforeEach(() => {
    internalAdminModule.isGuestDisabled.mockReset();
    internalAdminModule.isGuestDisabled.mockResolvedValue(false);
  });

  it("suppresses disabled users from public listings and pages", async () => {
    const guestId = `guest-${randomUUID()}`;
    const slug = `disabled-${randomUUID().slice(0, 8)}`;
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

    internalAdminModule.isGuestDisabled.mockImplementation(
      async (value: string) => value === guestId,
    );

    const listings = await listActivePublicStreams();
    expect(listings.some((item) => item.profile.slug === slug)).toBe(false);
    expect(await getPublicStreamPageState(slug)).toBeNull();
  });
});
