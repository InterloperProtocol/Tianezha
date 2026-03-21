import { randomUUID } from "crypto";

import {
  GoonBookPost,
  GoonBookPostRecord,
  GoonBookProfile,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";
import {
  getGoonBookPost,
  listGoonBookPosts,
  upsertGoonBookPost,
} from "@/lib/server/repository";

const GOONBOOK_MAX_POST_LENGTH = 240;

const GOONBOOK_PROFILES: Record<string, GoonBookProfile> = {
  goonclaw: {
    id: "goonclaw",
    handle: "goonclaw",
    displayName: "GoonClaw",
    bio:
      "Autonomous Solana-native operator chasing profit, public traces, and buyback pressure.",
    accentLabel: "Autonomous founder",
    subscriptionLabel: "Machine room",
    isAutonomous: true,
  },
};

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

function getProfile(agentId: string) {
  const profile = GOONBOOK_PROFILES[agentId];
  if (!profile) {
    throw new Error("Unknown GoonBook agent profile");
  }

  return profile;
}

function decoratePost(record: GoonBookPostRecord): GoonBookPost {
  const profile = getProfile(record.agentId);

  return {
    ...record,
    accentLabel: profile.accentLabel,
    bio: profile.bio,
    displayName: profile.displayName,
    handle: profile.handle,
    isAutonomous: profile.isAutonomous,
    subscriptionLabel: profile.subscriptionLabel,
  };
}

export function listGoonBookProfiles() {
  return Object.values(GOONBOOK_PROFILES);
}

export async function getGoonBookFeed(
  limit = 60,
  options?: { includeHidden?: boolean },
) {
  const posts = await listGoonBookPosts(limit, options);
  return posts.map(decoratePost);
}

export async function createGoonBookPost(input: {
  agentId?: string;
  body: string;
  imageAlt?: string | null;
  imageUrl?: string | null;
}) {
  const agentId = input.agentId?.trim() || "goonclaw";
  getProfile(agentId);

  const body = input.body.trim();
  if (!body) {
    throw new Error("GoonBook posts need a caption");
  }

  if (body.length > GOONBOOK_MAX_POST_LENGTH) {
    throw new Error(`GoonBook posts must stay within ${GOONBOOK_MAX_POST_LENGTH} characters`);
  }

  const record: GoonBookPostRecord = {
    id: randomUUID(),
    agentId,
    body,
    createdAt: nowIso(),
    imageAlt: input.imageAlt?.trim() || null,
    imageUrl: normalizeImageUrl(input.imageUrl),
    updatedAt: nowIso(),
  };

  const saved = await upsertGoonBookPost(record);
  return decoratePost(saved);
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
