import { z } from "zod";

import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import {
  getPublicStreamProfile,
  getPublicStreamProfileBySlug,
  listDevices,
  listPublicStreamProfiles,
  listRecoverableSessions,
  listSessions,
  upsertPublicStreamProfile,
} from "@/lib/server/repository";
import { isGuestDisabled } from "@/lib/server/internal-admin";
import {
  PublicStreamPageState,
  PublicStreamProfile,
  PublicStreamSummary,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";

const publicStreamSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-]+$/);

const upsertPublicStreamSchema = z.object({
  slug: publicStreamSlugSchema,
  isPublic: z.boolean(),
  defaultContractAddress: z.string().trim().min(1),
  mediaUrl: z.string().trim().default(""),
});

export function normalizePublicStreamSlug(value: string) {
  return publicStreamSlugSchema.parse(value.toLowerCase());
}

export function buildPublicStreamPath(slug: string) {
  return `/goonstreams/${slug}`;
}

export async function getCurrentPublicStreamProfile(guestId: string) {
  return getPublicStreamProfile(guestId);
}

export async function saveCurrentPublicStreamProfile(
  guestId: string,
  input: {
    slug: string;
    isPublic: boolean;
    defaultContractAddress: string;
    mediaUrl?: string;
  },
) {
  const parsed = upsertPublicStreamSchema.parse({
    slug: normalizePublicStreamSlug(input.slug),
    isPublic: input.isPublic,
    defaultContractAddress:
      input.defaultContractAddress.trim() || DEFAULT_PUMP_TOKEN_MINT,
    mediaUrl: input.mediaUrl?.trim() || "",
  });

  const [existing, slugOwner] = await Promise.all([
    getPublicStreamProfile(guestId),
    getPublicStreamProfileBySlug(parsed.slug),
  ]);

  if (slugOwner && slugOwner.guestId !== guestId) {
    throw new Error("That stream tag is already taken.");
  }

  const timestamp = nowIso();
  const next: PublicStreamProfile = {
    id: existing?.id || guestId,
    guestId,
    slug: parsed.slug,
    isPublic: parsed.isPublic,
    defaultContractAddress: parsed.defaultContractAddress,
    mediaUrl: parsed.mediaUrl,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  return upsertPublicStreamProfile(next);
}

export async function listActivePublicStreams() {
  const [profiles, sessions] = await Promise.all([
    listPublicStreamProfiles(),
    listRecoverableSessions(),
  ]);

  const publicProfiles = profiles.filter((profile) => profile.isPublic);
  const summaries: PublicStreamSummary[] = [];

  for (const profile of publicProfiles) {
    if (await isGuestDisabled(profile.guestId)) {
      continue;
    }

    const activeSession = sessions.find((session) => session.wallet === profile.guestId);
    if (!activeSession) {
      continue;
    }

    const devices = await listDevices(profile.guestId);
    const activeDevice = devices.find((device) => device.id === activeSession.deviceId);

    summaries.push({
      profile,
      activeSession,
      activeDeviceLabel: activeDevice?.label,
    });
  }

  return summaries.sort((left, right) =>
    right.activeSession.updatedAt.localeCompare(left.activeSession.updatedAt),
  );
}

export async function getPublicStreamPageState(
  slug: string,
): Promise<PublicStreamPageState | null> {
  const parsedSlug = publicStreamSlugSchema.safeParse(slug.toLowerCase());
  if (!parsedSlug.success) {
    return null;
  }

  const normalizedSlug = parsedSlug.data;
  const profile = await getPublicStreamProfileBySlug(normalizedSlug);
  if (!profile || !profile.isPublic) {
    return null;
  }

  if (await isGuestDisabled(profile.guestId)) {
    return null;
  }

  const [sessions, devices] = await Promise.all([
    listSessions(profile.guestId),
    listDevices(profile.guestId),
  ]);
  const activeSession =
    sessions.find(
      (session) => session.status === "active" || session.status === "starting",
    ) ?? null;
  const activeDevice = activeSession
    ? devices.find((device) => device.id === activeSession.deviceId)
    : null;

  return {
    profile,
    activeSession,
    activeDeviceLabel: activeDevice?.label,
    recentSessions: sessions.slice(0, 6),
  };
}
