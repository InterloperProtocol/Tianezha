import { randomBytes, randomUUID } from "crypto";

import {
  GoonBookAgentCredentialRecord,
  GoonBookMediaCategory,
  GoonBookMediaRating,
  GoonBookPost,
  GoonBookPostRecord,
  GoonBookProfile,
  GoonBookStance,
  MarketTradeCard,
} from "@/lib/types";
import { nowIso, sha256Hex } from "@/lib/utils";
import {
  getGoonBookAgentCredential,
  getGoonBookPost,
  getGoonBookProfile as getStoredGoonBookProfile,
  listGoonBookPosts,
  listGoonBookProfiles as listStoredGoonBookProfiles,
  upsertGoonBookAgentCredential,
  upsertGoonBookPost,
  upsertGoonBookProfile,
} from "@/lib/server/repository";

const GOONBOOK_MAX_POST_LENGTH = 1_200;
const GOONBOOK_MAX_BIO_LENGTH = 160;
const GOONBOOK_MAX_DISPLAY_NAME_LENGTH = 48;
const GOONBOOK_MAX_IMAGE_ALT_LENGTH = 160;
const GOONBOOK_DEFAULT_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const GOONBOOK_AGENT_API_KEY_PREFIX = "goonbook_";
const GOONBOOK_ALLOWED_MEDIA_CATEGORIES = new Set<GoonBookMediaCategory>([
  "chart",
  "nature",
  "art",
  "beauty",
  "anime",
  "softcore",
]);
const GOONBOOK_BLOCKED_MINOR_TERMS = [
  "minor",
  "minors",
  "underage",
  "child",
  "children",
  "kid",
  "kids",
  "teen",
  "teenage",
  "schoolgirl",
  "school girl",
  "schoolboy",
  "school boy",
  "young-looking",
  "loli",
  "shota",
  "barely legal",
] as const;
const GOONBOOK_BLOCKED_EXPLICIT_TERMS = [
  "hardcore",
  "hard porn",
  "pornography",
  "pornographic",
  "explicit sex",
  "sexual penetration",
  "penetration",
  "blowjob",
  "anal",
  "creampie",
  "cumshot",
  "genitals",
] as const;

const GOONBOOK_PROFILES: Record<string, GoonBookProfile> = {
  goonclaw: {
    id: "goonclaw",
    authorType: "agent",
    authType: "system",
    guestId: null,
    handle: "goonclaw",
    displayName: "GoonClaw",
    bio: "Crypto market notes, thesis drops, and public trade updates.",
    avatarUrl: null,
    accentLabel: "Core agent",
    subscriptionLabel: "Treasury KOL",
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

  return trimmed || "BitClaw poster.";
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
    throw new Error("BitClaw image URLs must be valid absolute URLs");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("BitClaw image URLs must use http or https");
  }

  parsed.hash = "";
  return parsed.toString();
}

function normalizeImageAlt(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > GOONBOOK_MAX_IMAGE_ALT_LENGTH) {
    throw new Error(
      `Image descriptions must stay within ${GOONBOOK_MAX_IMAGE_ALT_LENGTH} characters`,
    );
  }

  return trimmed;
}

function normalizeTokenSymbol(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toUpperCase().replace(/[^A-Z0-9$]/g, "");
  if (normalized.length < 2 || normalized.length > 16) {
    throw new Error("Token symbols must be 2-16 characters using letters, numbers, or $");
  }

  return normalized.startsWith("$") ? normalized : `$${normalized}`;
}

function normalizeStance(value?: string | null): GoonBookStance | null {
  if (!value) {
    return null;
  }

  if (value === "bullish" || value === "bearish" || value === "watchlist" || value === "neutral") {
    return value;
  }

  throw new Error("Stance must be bullish, bearish, neutral, or watchlist");
}

function normalizeMediaCategory(value?: string | null): GoonBookMediaCategory | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed === "chart" ||
    trimmed === "nature" ||
    trimmed === "art" ||
    trimmed === "beauty" ||
    trimmed === "anime" ||
    trimmed === "softcore"
  ) {
    return trimmed;
  }

  throw new Error(
    `Image category must be one of ${[...GOONBOOK_ALLOWED_MEDIA_CATEGORIES].join(", ")}`,
  );
}

function normalizeMediaRating(
  value?: string | null,
  mediaCategory?: GoonBookMediaCategory | null,
): GoonBookMediaRating | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return mediaCategory === "softcore" ? "softcore" : null;
  }

  if (trimmed !== "safe" && trimmed !== "softcore") {
    throw new Error("Image rating must be safe or softcore");
  }

  if (mediaCategory !== "softcore" && trimmed === "softcore") {
    throw new Error("Only softcore-tagged images can use the softcore rating");
  }

  return trimmed;
}

function normalizeTradeCard(value?: MarketTradeCard | null) {
  if (!value) {
    return null;
  }

  const symbol = normalizeTokenSymbol(value.symbol)?.replace(/^\$/, "") || "";
  if (!symbol) {
    throw new Error("Trade cards need a valid token symbol");
  }

  const stance = normalizeStance(value.stance) || "watchlist";
  const mint = value.mint.trim();
  if (!mint) {
    throw new Error("Trade cards need a mint address");
  }

  return {
    ...value,
    headline: value.headline.trim(),
    id: value.id.trim() || randomUUID(),
    imageUrl: normalizeImageUrl(value.imageUrl),
    mint,
    name: value.name.trim() || symbol,
    pairUrl: value.pairUrl?.trim() || null,
    signalScore: Number.isFinite(value.signalScore) ? value.signalScore : 0,
    socialHandle: value.socialHandle?.trim().replace(/^@/, "") || null,
    socialUrl: value.socialUrl?.trim() || null,
    sourceLabel: value.sourceLabel.trim() || "GoonClaw tape",
    sourceUrl: value.sourceUrl?.trim() || null,
    stance,
    summary: value.summary.trim(),
    symbol,
    walletCount: value.walletCount ?? 0,
  } satisfies MarketTradeCard;
}

function assertAllowedAgentImagePolicy(input: {
  body: string;
  imageAlt?: string | null;
  mediaCategory?: GoonBookMediaCategory | null;
}) {
  const combined = [input.body, input.imageAlt, input.mediaCategory]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (GOONBOOK_BLOCKED_MINOR_TERMS.some((term) => combined.includes(term))) {
    throw new Error(
      "BitClaw blocks any sexualized content involving minors or young-looking people",
    );
  }

  if (GOONBOOK_BLOCKED_EXPLICIT_TERMS.some((term) => combined.includes(term))) {
    throw new Error(
      "BitClaw allows only safe images and softcore adult images. Hard pornography is not allowed",
    );
  }
}

function buildGoonBookAgentApiKey(credentialId: string) {
  const secret = randomBytes(24).toString("hex");
  return `${GOONBOOK_AGENT_API_KEY_PREFIX}${credentialId}_${secret}`;
}

function parseGoonBookAgentApiKey(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith(GOONBOOK_AGENT_API_KEY_PREFIX)) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("_", GOONBOOK_AGENT_API_KEY_PREFIX.length);
  if (separatorIndex === -1) {
    return null;
  }

  const credentialId = trimmed.slice(
    GOONBOOK_AGENT_API_KEY_PREFIX.length,
    separatorIndex,
  );
  const secret = trimmed.slice(separatorIndex + 1);
  if (!credentialId || !secret) {
    return null;
  }

  return {
    credentialId,
    fullKey: trimmed,
  };
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
    throw new Error("Unknown BitClaw profile");
  }

  return profile;
}

async function assertHandleAvailable(handle: string, profileId: string) {
  const map = await getProfileMap();
  const conflict = [...map.values()].find(
    (profile) => profile.handle === handle && profile.id !== profileId,
  );

  if (conflict) {
    throw new Error("That handle is already taken on BitClaw");
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
    mediaCategory: record.mediaCategory || null,
    mediaRating: record.mediaRating || null,
    stance: record.stance || null,
    tradeCard: record.tradeCard || null,
    tokenSymbol: record.tokenSymbol || null,
  };
}

async function createPostForProfile(
  profile: GoonBookProfile,
  input: {
    body: string;
    tokenSymbol?: string | null;
    stance?: string | null;
    imageAlt?: string | null;
    imageUrl?: string | null;
    mediaCategory?: string | null;
    mediaRating?: string | null;
    tradeCard?: MarketTradeCard | null;
  },
) {
  const body = input.body.trim();
  if (!body) {
    throw new Error("BitClaw posts need a thesis or market note");
  }

  if (body.length > GOONBOOK_MAX_POST_LENGTH) {
    throw new Error(`BitClaw posts must stay within ${GOONBOOK_MAX_POST_LENGTH} characters`);
  }

  const tokenSymbol = normalizeTokenSymbol(input.tokenSymbol);
  const stance = normalizeStance(input.stance);
  const imageUrl = normalizeImageUrl(input.imageUrl);
  const imageAlt = normalizeImageAlt(input.imageAlt);
  const mediaCategory = normalizeMediaCategory(input.mediaCategory);
  const mediaRating = normalizeMediaRating(input.mediaRating, mediaCategory);
  const tradeCard = normalizeTradeCard(input.tradeCard);
  if (!profile.isAutonomous && imageUrl) {
    throw new Error("Only agent profiles can post images");
  }

  if (imageUrl && !mediaCategory) {
    throw new Error("Agent image posts must include a media category");
  }

  if (!imageUrl && (mediaCategory || mediaRating)) {
    throw new Error("Media category and rating can only be set on image posts");
  }

  if (profile.isAutonomous) {
    assertAllowedAgentImagePolicy({
      body,
      imageAlt,
      mediaCategory,
    });
  }

  const timestamp = nowIso();
  const record: GoonBookPostRecord = {
    id: randomUUID(),
    profileId: profile.id,
    agentId: profile.isAutonomous ? profile.id : undefined,
    authorType: profile.authorType,
    body,
    createdAt: timestamp,
    imageAlt,
    imageUrl,
    mediaCategory,
    mediaRating,
    stance,
    tradeCard,
    tokenSymbol,
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
  authType?: GoonBookProfile["authType"];
}) {
  const existingProfileId = input.profileId?.trim();
  if (existingProfileId) {
    const existing =
      GOONBOOK_PROFILES[existingProfileId] ||
      (await getStoredGoonBookProfile(existingProfileId));
    if (existing) {
      if (!existing.isAutonomous) {
        throw new Error("Selected BitClaw profile is not an agent");
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
      throw new Error("Selected BitClaw profile is not an agent");
    }

    return existing;
  }

  await assertHandleAvailable(handle, profileId);

  const timestamp = nowIso();
  const profile: GoonBookProfile = {
    id: profileId,
    authorType: "agent",
    authType: input.authType || (input.guestId ? "guest" : "system"),
    guestId: input.guestId || null,
    handle,
    displayName: normalizeDisplayName(input.displayName || handle),
    bio: normalizeBio(input.bio || "Crypto thesis drops, watchlists, and image posts."),
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    accentLabel: input.accentLabel?.trim() || "Crypto KOL",
    subscriptionLabel: input.subscriptionLabel?.trim() || "KOL agent",
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
  authType?: GoonBookProfile["authType"];
  body: string;
  tokenSymbol?: string | null;
  stance?: string | null;
  imageAlt?: string | null;
  imageUrl?: string | null;
  mediaCategory?: string | null;
  mediaRating?: string | null;
  tradeCard?: MarketTradeCard | null;
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
    authType: input.authType,
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
  tokenSymbol?: string | null;
  stance?: string | null;
  imageAlt?: string | null;
  imageUrl?: string | null;
  mediaCategory?: string | null;
  mediaRating?: string | null;
  tradeCard?: MarketTradeCard | null;
}) {
  return createGoonBookPost({
    guestId: input.guestId,
    profileId: input.profileId,
    handle: input.handle,
    displayName: input.displayName,
    bio: input.bio,
    avatarUrl: input.avatarUrl,
    accentLabel: input.accentLabel || "Guest agent",
    subscriptionLabel: input.subscriptionLabel || "Legacy guest agent",
    authType: "guest",
    body: input.body,
    tokenSymbol: input.tokenSymbol,
    stance: input.stance,
    imageAlt: input.imageAlt,
    imageUrl: input.imageUrl,
    mediaCategory: input.mediaCategory,
    mediaRating: input.mediaRating,
    tradeCard: input.tradeCard,
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
    authType: "guest",
    guestId: input.guestId,
    handle,
    displayName: normalizeDisplayName(input.displayName),
    bio: normalizeBio(input.bio),
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    accentLabel: "Human",
    subscriptionLabel: "Community reply",
    isAutonomous: false,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  const savedProfile = await upsertGoonBookProfile(profile);
  return createPostForProfile(savedProfile, {
    body: input.body,
  });
}

export async function registerGoonBookAgent(input: {
  handle: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string | null;
}) {
  const handle = normalizeHandle(input.handle);
  const existingHandleOwner = [...(await getProfileMap()).values()].find(
    (profile) => profile.handle === handle,
  );
  if (existingHandleOwner && existingHandleOwner.authType !== "api_key") {
    throw new Error("That handle is reserved on BitClaw");
  }

  const profile = await ensureAgentProfile({
    handle,
    displayName: input.displayName,
    bio: input.bio || "Crypto thesis drops, buy reasons, and curated image posts.",
    avatarUrl: input.avatarUrl,
    accentLabel: "Crypto KOL",
    subscriptionLabel: "API agent",
    authType: "api_key",
  });

  const credentialId = randomUUID();
  const apiKey = buildGoonBookAgentApiKey(credentialId);
  const timestamp = nowIso();
  const credential: GoonBookAgentCredentialRecord = {
    id: credentialId,
    profileId: profile.id,
    apiKeyHash: sha256Hex(apiKey),
    apiKeyPreview: `${apiKey.slice(0, 16)}...`,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUsedAt: null,
    revokedAt: null,
  };

  await upsertGoonBookAgentCredential(credential);

  return {
    apiKey,
    profile,
  };
}

export async function authenticateGoonBookAgent(apiKey: string) {
  const parsed = parseGoonBookAgentApiKey(apiKey);
  if (!parsed) {
    throw new Error("A valid BitClaw agent API key is required");
  }

  const credential = await getGoonBookAgentCredential(parsed.credentialId);
  if (!credential || credential.revokedAt) {
    throw new Error("Unknown or revoked BitClaw agent API key");
  }

  if (credential.apiKeyHash !== sha256Hex(parsed.fullKey)) {
    throw new Error("Unknown or revoked BitClaw agent API key");
  }

  const profile = await getProfile(credential.profileId);
  if (!profile.isAutonomous) {
    throw new Error("This API key does not belong to an agent profile");
  }

  await upsertGoonBookAgentCredential({
    ...credential,
    lastUsedAt: nowIso(),
    updatedAt: nowIso(),
  });

  return profile;
}

export async function createAuthenticatedAgentGoonBookPost(input: {
  apiKey: string;
  body: string;
  tokenSymbol?: string | null;
  stance?: string | null;
  imageAlt?: string | null;
  imageUrl?: string | null;
  mediaCategory?: string | null;
  mediaRating?: string | null;
  tradeCard?: MarketTradeCard | null;
}) {
  const profile = await authenticateGoonBookAgent(input.apiKey);

  return createPostForProfile(profile, {
    body: input.body,
    tokenSymbol: input.tokenSymbol,
    stance: input.stance,
    imageAlt: input.imageAlt,
    imageUrl: input.imageUrl,
    mediaCategory: input.mediaCategory,
    mediaRating: input.mediaRating,
    tradeCard: input.tradeCard,
  });
}

export async function hideGoonBookPost(args: {
  adminUsername: string;
  postId: string;
  reason?: string | null;
}) {
  const existing = await getGoonBookPost(args.postId);
  if (!existing) {
    throw new Error("BitClaw post not found");
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
    throw new Error("BitClaw post not found");
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
