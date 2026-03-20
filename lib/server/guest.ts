import { createHmac, randomUUID } from "crypto";

import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";
import { addDays, fromBase64Url, nowIso, toBase64Url } from "@/lib/utils";

const GUEST_COOKIE = "goonclaw_guest_session";

type GuestSession = {
  id: string;
  issuedAt: string;
  expiresAt: string;
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

async function persistGuestSession(session: GuestSession) {
  const serialized = toBase64Url(JSON.stringify(session));
  const signed = `${serialized}.${signValue(serialized)}`;
  const jar = await cookies();
  jar.set(GUEST_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

export async function getGuestSession() {
  const jar = await cookies();
  const raw = jar.get(GUEST_COOKIE)?.value;
  const payload = readSignedCookie<GuestSession>(raw);
  if (!payload) return null;
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    jar.delete(GUEST_COOKIE);
    return null;
  }
  return payload;
}

export async function getOrCreateGuestSession() {
  const existing = await getGuestSession();
  if (existing) return existing;

  const session: GuestSession = {
    id: `guest-${randomUUID()}`,
    issuedAt: nowIso(),
    expiresAt: addDays(new Date(), 2).toISOString(),
  };
  await persistGuestSession(session);
  return session;
}
