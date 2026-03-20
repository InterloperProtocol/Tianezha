import { createHmac } from "crypto";

import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";
import { getPayloadClient } from "@/lib/server/payload";
import {
  getSession,
  listPublicStreamProfiles,
  listRecoverableSessions,
} from "@/lib/server/repository";
import { dispatchSessionStop } from "@/lib/server/worker-client";
import { SessionRecord } from "@/lib/types";
import { addDays, fromBase64Url, nowIso, toBase64Url } from "@/lib/utils";

const INTERNAL_ADMIN_COOKIE = "goonclaw_internal_admin";
export const INTERNAL_ADMIN_ROUTE = "/amber-vault-ops";

type AdminUserDoc = {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
};

type StreamerControlDoc = {
  id: string;
  guestId: string;
  slug?: string | null;
  isDisabled?: boolean | null;
  disabledAt?: string | null;
  disabledBy?: string | null;
  reason?: string | null;
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

function normalizeAdminUser(doc: Partial<AdminUserDoc> | null | undefined) {
  if (!doc?.id || !doc.username) {
    return null;
  }

  return {
    id: String(doc.id),
    username: String(doc.username),
    displayName: doc.displayName ? String(doc.displayName) : null,
  };
}

function deriveAdminEmail(username: string) {
  return `${username}@goonclaw.internal`;
}

export async function ensureSeededInternalAdmin() {
  const env = getServerEnv();
  const password = env.INTERNAL_ADMIN_PASSWORD.trim();
  if (!password) {
    return null;
  }

  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: "admins",
    depth: 0,
    limit: 1,
    overrideAccess: true,
  });

  if (existing.docs.length > 0) {
    return normalizeAdminUser(existing.docs[0] as Partial<AdminUserDoc>);
  }

  const username = env.INTERNAL_ADMIN_LOGIN.trim() || "admin";
  const created = await payload.create({
    collection: "admins",
    data: {
      displayName: "Internal Admin",
      email: deriveAdminEmail(username),
      password,
      username,
    },
    depth: 0,
    overrideAccess: true,
  });

  return normalizeAdminUser(created as Partial<AdminUserDoc>);
}

export async function loginInternalAdmin(username: string, password: string) {
  await ensureSeededInternalAdmin();

  const payload = await getPayloadClient();
  const result = await payload.login({
    collection: "admins",
    data: {
      password,
      username,
    } as never,
    depth: 0,
    overrideAccess: true,
  });

  const user = normalizeAdminUser(result.user as Partial<AdminUserDoc>);
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
}

export async function clearInternalAdminSession() {
  const jar = await cookies();
  jar.delete(INTERNAL_ADMIN_COOKIE);
}

export async function getInternalAdminSession() {
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

  const client = await getPayloadClient();
  const admin = await client.findByID({
    collection: "admins",
    depth: 0,
    id: payload.id,
    overrideAccess: true,
  }).catch(() => null);

  const user = normalizeAdminUser(admin as Partial<AdminUserDoc>);
  if (!user) {
    jar.delete(INTERNAL_ADMIN_COOKIE);
    return null;
  }

  return user;
}

export async function requireInternalAdminSession() {
  const session = await getInternalAdminSession();
  if (!session) {
    throw new Error("Admin authentication required");
  }
  return session;
}

async function findStreamerControl(guestId: string) {
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

  return (result.docs[0] as StreamerControlDoc | undefined) ?? null;
}

async function listStreamerControls() {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "streamer-controls",
    depth: 0,
    limit: 200,
    overrideAccess: true,
  });

  return result.docs as StreamerControlDoc[];
}

async function upsertStreamerControl(
  guestId: string,
  data: Omit<StreamerControlDoc, "id" | "guestId">,
) {
  const payload = await getPayloadClient();
  const existing = await findStreamerControl(guestId);

  if (existing?.id) {
    return (await payload.update({
      collection: "streamer-controls",
      data,
      depth: 0,
      id: existing.id,
      overrideAccess: true,
    })) as StreamerControlDoc;
  }

  return (await payload.create({
    collection: "streamer-controls",
    data: {
      guestId,
      ...data,
    },
    depth: 0,
    overrideAccess: true,
  })) as StreamerControlDoc;
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

export async function stopSessionFromAdmin(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  return dispatchSessionStop(sessionId);
}

export async function getInternalAdminDashboardData() {
  const [controls, publicProfiles, recoverableSessions] = await Promise.all([
    listStreamerControls(),
    listPublicStreamProfiles(),
    listRecoverableSessions(),
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

  return {
    activeSessions,
    users,
  };
}
