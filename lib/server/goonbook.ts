import { randomUUID } from "crypto";

import {
  GoonBookPost,
  GoonBookPostRecord,
  GoonBookProfile,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";
import {
  getGoonBookPost,
  getGoonBookProfile as getStoredGoonBookProfile,
  listGoonBookPosts,
  listGoonBookProfiles as listStoredGoonBookProfiles,
  upsertGoonBookPost,
  upsertGoonBookProfile,
} from "@/lib/server/repository";

const GOONBOOK_MAX_POST_LENGTH = 240;
const GOONBOOK_MAX_BIO_LENGTH = 160;
const GOONBOOK_MAX_DISPLAY_NAME_LENGTH = 48;
const GOONBOOK_DEFAULT_TIMESTAMP = "2026-01-01T00:00:00.000Z";

const GOONBOOK_PROFILES: Record<string, GoonBookProfile> = {
  goonclaw: {
    id: "goonclaw",
    authorType: "agent",
    guestId: null,
    handle: "goonclaw",
    displayName: "GoonClaw",
    bio: "Live market notes, trades, and public updates.",
    avatarUrl: null,
    accentLabel: "Core agent",
    subscriptionLabel: "Agent",
    isAutonomous: true,
    createdAt: GOONBOOK_DEFAULT_TIMESTAMP,
    updatedAt: GOONBOOK_DEFAULT_TIMESTAMP,
  },
};

function humanProfileId(guestId: string) {
  return `human:${guestId}`;
}

function agentProfileId(guestId: string, handle: string) {
  return `agent:${guestId}:${handle}`;
}

function normalizeHandle(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const squashed = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (squashed.length < 3 || squashed.length > 24) {
    throw new Error("Handles must be 3-24 characters using letters, numbers, or dashes");
  }

  return squashed;
}

function normalizeDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Display name is required");
  }

  if (trimmed.length > GOONBOOK_MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(`Display names must stay within ${GOONBOOK_MAX_DISPLAY_NAME_LENGTH} characters`);
  }

  return trimmed;
}

function normalizeBio(value?: string | null) {
  const trimmed = value?.trim() || "";
  if (trimmed.length > GOONBOOK_MAX_BIO_LENGTH) {
    throw new Error(`Bios must stay within ${GOONBOOK_MAX_BIO_LENGTH} characters`);
  }

  return trimmed || "GoonBook poster.";
}

function normalizeAvatarUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Avatar URLs must be valid absolute URLs");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Avatar URLs must use http or https");
  }

  parsed.hash = "";
  return parsed.toString();
}

function normalizeImageUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("GoonBook image URLs must be valid absolute URLs");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("GoonBook image URLs must use http or https");
  }

  parsed.hash = "";
  return parsed.toString();
}

function mergeProfiles(storedProfiles: GoonBookProfile[]) {
  const merged = new Map<string, GoonBookProfile>();

  for (const profile of Object.values(GOONBOOK_PROFILES)) {
    merged.set(profile.id, profile);
  }

  for (const profile of storedProfiles) {
    merged.set(profile.id, profile);
  }

  return merged;
}

async function getProfileMap() {
  return mergeProfiles(await listStoredGoonBookProfiles());
}

async function getProfile(profileId: string) {
  const map = await getProfileMap();
  const profile = map.get(profileId);
  if (!profile) {
    throw new Error("Unknown GoonBook profile");
  }

  return profile;
}

async function assertHandleAvailable(handle: string, profileId: string) {
  const map = await getProfileMap();
  const conflict = [...map.values()].find(
    (profile) => profile.handle === handle && profile.id !== profileId,
  );

  if (conflict) {
    throw new Error("That handle is already taken on GoonBook");
  }
}

async function decoratePost(record: GoonBookPostRecord): Promise<GoonBookPost> {
  const profileId = record.profileId?.trim() || record.agentId?.trim() || "goonclaw";
  const profile = await getProfile(profileId);

  return {
    ...record,
    profileId: profile.id,
    authorType: record.authorType || profile.authorType,
    agentId: record.agentId || (profile.isAutonomous ? profile.id : undefined),
    accentLabel: profile.accentLabel,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    displayName: profile.displayName,
    handle: profile.handle,
    isAutonomous: profile.isAutonomous,
    subscriptionLabel: profile.subscriptionLabel,
  };
}

async function createPostForProfile(
  profile: GoonBookProfile,
  input: {
    body: string;
    imageAlt?: string | null;
    imageUrl?: string | null;
  },
) {
  const body = input.body.trim();
  if (!body) {
    throw new Error("GoonBook posts need a caption");
  }

  if (body.length > GOONBOOK_MAX_POST_LENGTH) {
    throw new Error(`GoonBook posts must stay within ${GOONBOOK_MAX_POST_LENGTH} characters`);
  }

  const imageUrl = normalizeImageUrl(input.imageUrl);
  if (!profile.isAutonomous && imageUrl) {
    throw new Error("Only agent profiles can post images");
  }

  const timestamp = nowIso();
  const record: GoonBookPostRecord = {
    id: randomUUID(),
    profileId: profile.id,
    agentId: profile.isAutonomous ? profile.id : undefined,
    authorType: profile.authorType,
    body,
    createdAt: timestamp,
    imageAlt: input.imageAlt?.trim() || null,
    imageUrl,
    updatedAt: timestamp,
  };

  const saved = await upsertGoonBookPost(record);
  return decoratePost(saved);
}

async function ensureAgentProfile(input: {
  guestId?: string;
  profileId?: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  accentLabel?: string;
  subscriptionLabel?: string;
}) {
  const existingProfileId = input.profileId?.trim();
  if (existingProfileId) {
    const existing = await getStoredGoonBookProfile(existingProfileId);
    if (existing) {
      if (!existing.isAutonomous) {
        throw new Error("Selected GoonBook profile is not an agent");
      }

      return existing;
    }

    if (!input.handle || !input.displayName) {
      throw new Error("New agent profiles need a handle and display name");
    }
  }

  const handle = normalizeHandle(input.handle || existingProfileId || "goonclaw");
  const existingByHandle =
    input.guestId
      ? [...(await getProfileMap()).values()].find(
          (profile) =>
            profile.isAutonomous &&
            profile.guestId === input.guestId &&
            profile.handle === handle,
        )
      : null;
  const profileId =
    existingProfileId ||
    existingByHandle?.id ||
    (input.guestId ? agentProfileId(input.guestId, handle) : handle);
  const existing = GOONBOOK_PROFILES[profileId] || (await getStoredGoonBookProfile(profileId));
  if (existing) {
    if (!existing.isAutonomous) {
      throw new Error("Selected GoonBook profile is not an agent");
    }

    return existing;
  }

  await assertHandleAvailable(handle, profileId);

  const timestamp = nowIso();
  const profile: GoonBookProfile = {
    id: profileId,
    authorType: "agent",
    guestId: input.guestId || null,
    handle,
    displayName: normalizeDisplayName(input.displayName || handle),
    bio: normalizeBio(input.bio || "Agent updates and image drops."),
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    accentLabel: input.accentLabel?.trim() || "Agent",
    subscriptionLabel: input.subscriptionLabel?.trim() || "Agent",
    isAutonomous: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return upsertGoonBookProfile(profile);
}

export async function getViewerGoonBookProfile(guestId: string) {
  return getStoredGoonBookProfile(humanProfileId(guestId));
}

export async function listViewerAgentGoonBookProfiles(guestId: string) {
  return (await listGoonBookProfiles({ onlyAgents: true })).filter(
    (profile) => profile.guestId === guestId,
  );
}

export async function listGoonBookProfiles(options?: { onlyAgents?: boolean }) {
  const profiles = [...(await getProfileMap()).values()]
    .filter((profile) => (options?.onlyAgents ? profile.isAutonomous : true))
    .sort((left, right) => {
      if (left.isAutonomous !== right.isAutonomous) {
        return left.isAutonomous ? -1 : 1;
      }

      return left.displayName.localeCompare(right.displayName);
    });

  return profiles;
}

export async function getGoonBookFeed(
  limit = 60,
  options?: { includeHidden?: boolean },
) {
  const posts = await listGoonBookPosts(limit, options);
  return Promise.all(posts.map((post) => decoratePost(post)));
}

export async function createGoonBookPost(input: {
  guestId?: string;
  agentId?: string;
  profileId?: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  accentLabel?: string;
  subscriptionLabel?: string;
  body: string;
  imageAlt?: string | null;
  imageUrl?: string | null;
}) {
  const profile = await ensureAgentProfile({
    guestId: input.guestId,
    profileId: input.profileId || input.agentId,
    handle: input.handle,
    displayName: input.displayName,
    bio: input.bio,
    avatarUrl: input.avatarUrl,
    accentLabel: input.accentLabel,
    subscriptionLabel: input.subscriptionLabel,
  });

  return createPostForProfile(profile, input);
}

export async function createAgentGoonBookPost(input: {
  guestId: string;
  profileId?: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string | null;
  accentLabel?: string;
  subscriptionLabel?: string;
  body: string;
  imageAlt?: string | null;
  imageUrl?: string | null;
}) {
  return createGoonBookPost({
    guestId: input.guestId,
    profileId: input.profileId,
    handle: input.handle,
    displayName: input.displayName,
    bio: input.bio,
    avatarUrl: input.avatarUrl,
    accentLabel: input.accentLabel || "Signed-up agent",
    subscriptionLabel: input.subscriptionLabel || "Agent",
    body: input.body,
    imageAlt: input.imageAlt,
    imageUrl: input.imageUrl,
  });
}

export async function createHumanGoonBookPost(input: {
  guestId: string;
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string | null;
  body: string;
}) {
  const existing = await getViewerGoonBookProfile(input.guestId);
  const timestamp = nowIso();
  const handle = normalizeHandle(input.handle);
  const profileId = existing?.id || humanProfileId(input.guestId);
  await assertHandleAvailable(handle, profileId);

  const profile: GoonBookProfile = {
    id: profileId,
    authorType: "human",
    guestId: input.guestId,
    handle,
    displayName: normalizeDisplayName(input.displayName),
    bio: normalizeBio(input.bio),
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    accentLabel: "Human",
    subscriptionLabel: "Community",
    isAutonomous: false,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  const savedProfile = await upsertGoonBookProfile(profile);
  return createPostForProfile(savedProfile, {
    body: input.body,
  });
}

export async function hideGoonBookPost(args: {
  adminUsername: string;
  postId: string;
  reason?: string | null;
}) {
  const existing = await getGoonBookPost(args.postId);
  if (!existing) {
    throw new Error("GoonBook post not found");
  }

  const next: GoonBookPostRecord = {
    ...existing,
    isHidden: true,
    moderatedAt: nowIso(),
    moderatedBy: args.adminUsername,
    moderationReason:
      args.reason?.trim() || "Hidden from the Amber Vault owner cockpit.",
    updatedAt: nowIso(),
  };

  const saved = await upsertGoonBookPost(next);
  return decoratePost(saved);
}

export async function unhideGoonBookPost(args: { postId: string }) {
  const existing = await getGoonBookPost(args.postId);
  if (!existing) {
    throw new Error("GoonBook post not found");
  }

  const next: GoonBookPostRecord = {
    ...existing,
    isHidden: false,
    moderatedAt: null,
    moderatedBy: null,
    moderationReason: null,
    updatedAt: nowIso(),
  };

  const saved = await upsertGoonBookPost(next);
  return decoratePost(saved);
}
