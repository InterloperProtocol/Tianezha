import { createHmac } from "crypto";

import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";
import {
  getAutonomousRuntimeSummary,
} from "@/lib/server/autonomous-agent";
import { getPayloadClient } from "@/lib/server/payload";
import {
  getSession,
  listBitClawPosts,
  listPublicStreamProfiles,
  listRecoverableSessions,
  upsertPublicStreamProfile,
} from "@/lib/server/repository";
import { dispatchSessionStop } from "@/lib/server/worker-client";
import {
  AutonomousRuntimeSummary,
  BitClawPostRecord,
  SessionRecord,
} from "@/lib/types";
import { addDays, fromBase64Url, nowIso, toBase64Url } from "@/lib/utils";

const INTERNAL_ADMIN_COOKIE = "tianshi_internal_admin";
export const INTERNAL_ADMIN_ROUTE = "/amber-vault-ops";

type StreamerControlDoc = {
  id: string;
  guestId: string;
  slug?: string | null;
  isDisabled?: boolean | null;
  disabledAt?: string | null;
  disabledBy?: string | null;
  reason?: string | null;
  hiddenAt?: string | null;
  hiddenBy?: string | null;
  hiddenReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type AdminSession = {
  id: string;
  username: string;
  issuedAt: string;
  expiresAt: string;
};

type DashboardSession = SessionRecord & {
  publicSlug: string | null;
  isPublicProfile: boolean;
  isDisabled: boolean;
};

type DashboardUser = {
  guestId: string;
  slug: string | null;
  defaultContractAddress: string | null;
  hasPublicProfile: boolean;
  hasActiveSession: boolean;
  isDisabled: boolean;
  disabledAt: string | null;
  disabledBy: string | null;
  reason: string | null;
};

type DashboardBolClawProfile = {
  guestId: string;
  slug: string;
  defaultContractAddress: string | null;
  isPublic: boolean;
  isHidden: boolean;
  isDisabled: boolean;
  hasActiveSession: boolean;
  activeSessionId: string | null;
  activeSessionStatus: string | null;
  activeSessionUpdatedAt: string | null;
  moderatedAt: string | null;
  moderatedBy: string | null;
  moderationReason: string | null;
};

type DashboardBitClawPost = BitClawPostRecord & {
  displayName: string;
  handle: string;
};

function getConfiguredInternalAdmin() {
  const env = getServerEnv();
  const username = env.INTERNAL_ADMIN_LOGIN.trim() || "admin";
  const password = env.INTERNAL_ADMIN_PASSWORD.trim();

  return {
    password,
    user: {
      displayName: "Internal Admin",
      id: `env-admin:${username}`,
      username,
    },
    username,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function signValue(value: string) {
  return createHmac("sha256", getServerEnv().APP_SESSION_SECRET)
    .update(value)
    .digest("hex");
}

function readSignedCookie<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  if (signValue(payload) !== signature) return null;
  return JSON.parse(fromBase64Url(payload)) as T;
}

async function persistAdminSession(session: AdminSession) {
  const serialized = toBase64Url(JSON.stringify(session));
  const signed = `${serialized}.${signValue(serialized)}`;
  const jar = await cookies();
  jar.set(INTERNAL_ADMIN_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

function normalizeAdminUser(doc: unknown) {
  const record = asRecord(doc);
  if (!record?.id || !record.username) {
    return null;
  }

  return {
    id: String(record.id),
    username: String(record.username),
    displayName: record.displayName ? String(record.displayName) : null,
  };
}

function normalizeStreamerControl(doc: unknown): StreamerControlDoc | null {
  const record = asRecord(doc);
  if (!record?.guestId) {
    return null;
  }

  return {
    id: record.id ? String(record.id) : "",
    guestId: String(record.guestId),
    slug: typeof record.slug === "string" ? record.slug : null,
    isDisabled:
      typeof record.isDisabled === "boolean" ? record.isDisabled : null,
    disabledAt:
      typeof record.disabledAt === "string" ? record.disabledAt : null,
    disabledBy:
      typeof record.disabledBy === "string" ? record.disabledBy : null,
    reason: typeof record.reason === "string" ? record.reason : null,
    hiddenAt: typeof record.hiddenAt === "string" ? record.hiddenAt : null,
    hiddenBy: typeof record.hiddenBy === "string" ? record.hiddenBy : null,
    hiddenReason:
      typeof record.hiddenReason === "string" ? record.hiddenReason : null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

function isPayloadUnavailableError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return (
    message.includes("cannot connect to SQLite") ||
    message.includes("Unable to open connection to local database") ||
    message.includes("ConnectionFailed") ||
    message.includes("Failed query:") ||
    message.includes("no such table") ||
    message.includes("does not exist")
  );
}

function logPayloadUnavailable(context: string, error: unknown) {
  if (!isPayloadUnavailableError(error)) {
    return false;
  }

  console.warn(`[internal-admin] Payload unavailable during ${context}`, error);
  return true;
}

function deriveAdminEmail(username: string) {
  return `${username}@tianshi.internal`;
}

export async function ensureSeededInternalAdmin() {
  const configuredAdmin = getConfiguredInternalAdmin();
  const password = configuredAdmin.password;
  if (!password) {
    return null;
  }

  try {
    const payload = await getPayloadClient();
    const username = configuredAdmin.username;
    const email = deriveAdminEmail(username);
    const existing = await payload.find({
      collection: "admins",
      depth: 0,
      limit: 10,
      overrideAccess: true,
    });

    const matchingAdmin =
      existing.docs.find((doc) => {
        const record = asRecord(doc);
        return record?.username === username;
      }) ?? existing.docs[0];

    if (matchingAdmin) {
      const updated = await payload.update({
        id: String(asRecord(matchingAdmin)?.id),
        collection: "admins",
        data: {
          displayName: "Internal Admin",
          email,
          password,
          username,
        },
        depth: 0,
        overrideAccess: true,
      });

      return normalizeAdminUser(updated);
    }

    const created = await payload.create({
      collection: "admins",
      data: {
        displayName: "Internal Admin",
        email,
        password,
        username,
      },
      depth: 0,
      overrideAccess: true,
    });

    return normalizeAdminUser(created);
  } catch (error) {
    if (logPayloadUnavailable("ensureSeededInternalAdmin", error)) {
      return configuredAdmin.user;
    }
    throw error;
  }
}

export async function loginInternalAdmin(username: string, password: string) {
  const configuredAdmin = getConfiguredInternalAdmin();
  const normalizedUsername = username.trim();

  if (!configuredAdmin.password) {
    throw new Error("Internal admin password is not configured.");
  }

  await ensureSeededInternalAdmin();

  try {
    const payload = await getPayloadClient();
    const result = await payload.login({
      collection: "admins",
      data: {
        password,
        username: normalizedUsername,
      } as never,
      depth: 0,
      overrideAccess: true,
    });

    const user = normalizeAdminUser(result.user);
    if (!user) {
      throw new Error("Admin account could not be loaded");
    }

    await persistAdminSession({
      id: user.id,
      username: user.username,
      issuedAt: nowIso(),
      expiresAt: addDays(new Date(), 7).toISOString(),
    });

    return user;
  } catch (error) {
    if (logPayloadUnavailable("loginInternalAdmin", error)) {
      if (
        normalizedUsername === configuredAdmin.username &&
        password === configuredAdmin.password
      ) {
        await persistAdminSession({
          id: configuredAdmin.user.id,
          username: configuredAdmin.user.username,
          issuedAt: nowIso(),
          expiresAt: addDays(new Date(), 7).toISOString(),
        });

        return configuredAdmin.user;
      }

      throw new Error("Invalid admin credentials");
    }
    throw error;
  }
}

export async function clearInternalAdminSession() {
  const jar = await cookies();
  jar.delete(INTERNAL_ADMIN_COOKIE);
}

export async function getInternalAdminSession() {
  const configuredAdmin = getConfiguredInternalAdmin();
  const jar = await cookies();
  const raw = jar.get(INTERNAL_ADMIN_COOKIE)?.value;
  const payload = readSignedCookie<AdminSession>(raw);
  if (!payload) {
    return null;
  }

  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    jar.delete(INTERNAL_ADMIN_COOKIE);
    return null;
  }

  if (payload.username !== configuredAdmin.username) {
    jar.delete(INTERNAL_ADMIN_COOKIE);
    return null;
  }

  if (payload.id === configuredAdmin.user.id) {
    return configuredAdmin.user;
  }

  try {
    const client = await getPayloadClient();
    const admin = await client
      .findByID({
        collection: "admins",
        depth: 0,
        id: payload.id,
        overrideAccess: true,
      })
      .catch(() => null);

    const user = normalizeAdminUser(admin);
    if (!user) {
      jar.delete(INTERNAL_ADMIN_COOKIE);
      return null;
    }

    return user;
  } catch (error) {
    if (logPayloadUnavailable("getInternalAdminSession", error)) {
      return configuredAdmin.user;
    }
    throw error;
  }
}

export async function requireInternalAdminSession() {
  const session = await getInternalAdminSession();
  if (!session) {
    throw new Error("Admin authentication required");
  }
  return session;
}

async function findStreamerControl(guestId: string) {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "streamer-controls",
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        guestId: {
          equals: guestId,
        },
      },
    });

    return normalizeStreamerControl(result.docs[0]);
  } catch (error) {
    if (logPayloadUnavailable("findStreamerControl", error)) {
      return null;
    }
    throw error;
  }
}

async function listStreamerControls() {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "streamer-controls",
      depth: 0,
      limit: 200,
      overrideAccess: true,
    });

    return result.docs
      .map((doc) => normalizeStreamerControl(doc))
      .filter((doc): doc is StreamerControlDoc => Boolean(doc));
  } catch (error) {
    if (logPayloadUnavailable("listStreamerControls", error)) {
      return [];
    }
    throw error;
  }
}

async function upsertStreamerControl(
  guestId: string,
  data: Omit<StreamerControlDoc, "id" | "guestId">,
) {
  try {
    const payload = await getPayloadClient();
    const existing = await findStreamerControl(guestId);

    if (existing?.id) {
      const updated = await payload.update({
        collection: "streamer-controls",
        data,
        depth: 0,
        id: existing.id,
        overrideAccess: true,
      });
      const normalized = normalizeStreamerControl(updated);
      if (!normalized) {
        throw new Error("Streamer control update failed");
      }
      return normalized;
    }

    const created = await payload.create({
      collection: "streamer-controls",
      data: {
        guestId,
        ...data,
      },
      depth: 0,
      overrideAccess: true,
    });
    const normalized = normalizeStreamerControl(created);
    if (!normalized) {
      throw new Error("Streamer control create failed");
    }
    return normalized;
  } catch (error) {
    if (logPayloadUnavailable("upsertStreamerControl", error)) {
      return {
        id: "",
        guestId,
        ...data,
      };
    }
    throw error;
  }
}

export async function isGuestDisabled(guestId: string) {
  const control = await findStreamerControl(guestId);
  return Boolean(control?.isDisabled);
}

export async function assertGuestEnabled(guestId: string) {
  if (await isGuestDisabled(guestId)) {
    throw new Error("This user has been disabled by the admin.");
  }
}

async function stopSessionsForGuest(guestId: string) {
  const sessions = await listRecoverableSessions();
  await Promise.all(
    sessions
      .filter((session) => session.wallet === guestId)
      .map((session) => dispatchSessionStop(session.id).catch(() => null)),
  );
}

export async function disableGuestAccount(args: {
  guestId: string;
  slug?: string | null;
  reason?: string | null;
  adminUsername: string;
}) {
  await stopSessionsForGuest(args.guestId);

  return upsertStreamerControl(args.guestId, {
    disabledAt: nowIso(),
    disabledBy: args.adminUsername,
    isDisabled: true,
    reason: args.reason?.trim() || "Disabled from the hidden admin dashboard.",
    slug: args.slug?.trim() || "",
  });
}

export async function enableGuestAccount(args: {
  guestId: string;
  slug?: string | null;
}) {
  return upsertStreamerControl(args.guestId, {
    disabledAt: null,
    disabledBy: null,
    isDisabled: false,
    reason: "",
    slug: args.slug?.trim() || "",
  });
}

export async function hidePublicStreamProfile(args: {
  guestId: string;
  adminUsername: string;
  reason?: string | null;
}) {
  const existing = await getPublicStreamProfileOrThrow(args.guestId);
  const timestamp = nowIso();

  const updated = await upsertPublicStreamProfile({
    ...existing,
    isHidden: true,
    moderatedAt: timestamp,
    moderatedBy: args.adminUsername,
    moderationReason:
      args.reason?.trim() || "Hidden from the Amber Vault owner cockpit.",
    updatedAt: timestamp,
  });

  return updated;
}

export async function unhidePublicStreamProfile(args: { guestId: string }) {
  const existing = await getPublicStreamProfileOrThrow(args.guestId);
  const timestamp = nowIso();

  const updated = await upsertPublicStreamProfile({
    ...existing,
    isHidden: false,
    moderatedAt: null,
    moderatedBy: null,
    moderationReason: null,
    updatedAt: timestamp,
  });

  return updated;
}

function getProfileHandle(profileId?: string, agentId?: string) {
  const source = profileId || agentId || "unknown";
  const normalized = source.startsWith("human:") ? source.slice(6) : source;

  return normalized === "tianshi"
    ? { displayName: "Tianshi", handle: "tianshi" }
    : { displayName: normalized, handle: normalized };
}

function buildRuntimeSummary(): AutonomousRuntimeSummary {
  return getAutonomousRuntimeSummary();
}

async function getPublicStreamProfileOrThrow(guestId: string) {
  const profiles = await listPublicStreamProfiles();
  const profile = profiles.find((item) => item.guestId === guestId) || null;
  if (!profile) {
    throw new Error("Public stream profile not found");
  }

  return profile;
}

export async function stopSessionFromAdmin(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  return dispatchSessionStop(sessionId);
}

export async function getInternalAdminDashboardData() {
  const [controls, publicProfiles, recoverableSessions, bitClawPosts] =
    await Promise.all([
    listStreamerControls(),
    listPublicStreamProfiles(),
    listRecoverableSessions(),
    listBitClawPosts(24, { includeHidden: true }),
  ]);

  const controlMap = new Map(controls.map((item) => [item.guestId, item]));
  const profileMap = new Map(publicProfiles.map((item) => [item.guestId, item]));

  const activeSessions: DashboardSession[] = recoverableSessions.map((session) => {
    const control = controlMap.get(session.wallet);
    const profile = profileMap.get(session.wallet);

    return {
      ...session,
      isDisabled: Boolean(control?.isDisabled),
      isPublicProfile: Boolean(profile?.isPublic),
      publicSlug: profile?.slug || null,
    };
  });

  const allGuestIds = new Set<string>([
    ...controls.map((item) => item.guestId),
    ...publicProfiles.map((item) => item.guestId),
    ...recoverableSessions.map((item) => item.wallet),
  ]);

  const users: DashboardUser[] = [...allGuestIds]
    .map((guestId) => {
      const profile = profileMap.get(guestId);
      const control = controlMap.get(guestId);
      const hasActiveSession = recoverableSessions.some(
        (session) => session.wallet === guestId,
      );

      return {
        defaultContractAddress: profile?.defaultContractAddress || null,
        disabledAt: control?.disabledAt || null,
        disabledBy: control?.disabledBy || null,
        guestId,
        hasActiveSession,
        hasPublicProfile: Boolean(profile),
        isDisabled: Boolean(control?.isDisabled),
        reason: control?.reason || null,
        slug: profile?.slug || control?.slug || null,
      };
    })
    .sort((left, right) => {
      if (left.isDisabled !== right.isDisabled) {
        return left.isDisabled ? -1 : 1;
      }

      if (left.hasActiveSession !== right.hasActiveSession) {
        return left.hasActiveSession ? -1 : 1;
      }

      return (left.slug || left.guestId).localeCompare(right.slug || right.guestId);
    });

  const bolClawProfiles: DashboardBolClawProfile[] = publicProfiles
    .map((profile) => {
      const control = controlMap.get(profile.guestId);
      const activeSession =
        recoverableSessions.find((session) => session.wallet === profile.guestId) ?? null;

      return {
        guestId: profile.guestId,
        slug: profile.slug,
        defaultContractAddress: profile.defaultContractAddress || null,
        isPublic: profile.isPublic,
        isHidden: Boolean(profile.isHidden),
        isDisabled: Boolean(control?.isDisabled),
        hasActiveSession: Boolean(activeSession),
        activeSessionId: activeSession?.id || null,
        activeSessionStatus: activeSession?.status || null,
        activeSessionUpdatedAt: activeSession?.updatedAt || null,
        moderatedAt: profile.moderatedAt || null,
        moderatedBy: profile.moderatedBy || null,
        moderationReason: profile.moderationReason || null,
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));

  const dashboardBitClawPosts: DashboardBitClawPost[] = bitClawPosts.map((post) => {
    const profile = getProfileHandle(post.profileId, post.agentId);
    return {
      ...post,
      displayName: profile.displayName,
      handle: profile.handle,
    };
  });

  return {
    activeSessions,
    bitClawPosts: dashboardBitClawPosts,
    bolClawProfiles,
    runtimeSummary: buildRuntimeSummary(),
    users,
  };
}
