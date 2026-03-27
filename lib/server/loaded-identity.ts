import { createHmac, randomUUID } from "crypto";

import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";
import { addDays, fromBase64Url, nowIso, toBase64Url } from "@/lib/utils";

const LOADED_IDENTITY_COOKIE = "tianshi_loaded_identity";

type LoadedIdentitySessionCookie = {
  expiresAt: string;
  id: string;
  issuedAt: string;
  profileId: string;
};

function signValue(value: string) {
  return createHmac("sha256", getServerEnv().APP_SESSION_SECRET)
    .update(value)
    .digest("hex");
}

function readSignedCookie<T>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }

  if (signValue(payload) !== signature) {
    return null;
  }

  return JSON.parse(fromBase64Url(payload)) as T;
}

async function persistLoadedIdentityCookie(session: LoadedIdentitySessionCookie) {
  const serialized = toBase64Url(JSON.stringify(session));
  const signed = `${serialized}.${signValue(serialized)}`;
  const jar = await cookies();
  jar.set(LOADED_IDENTITY_COOKIE, signed, {
    expires: new Date(session.expiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
  });
}

export async function getLoadedIdentityCookie() {
  const jar = await cookies();
  const raw = jar.get(LOADED_IDENTITY_COOKIE)?.value;
  const payload = readSignedCookie<LoadedIdentitySessionCookie>(raw);
  if (!payload) {
    return null;
  }

  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    jar.delete(LOADED_IDENTITY_COOKIE);
    return null;
  }

  return payload;
}

export async function setLoadedIdentityCookie(profileId: string) {
  const session = {
    expiresAt: addDays(new Date(), 7).toISOString(),
    id: `loaded-${randomUUID()}`,
    issuedAt: nowIso(),
    profileId,
  } satisfies LoadedIdentitySessionCookie;

  await persistLoadedIdentityCookie(session);
  return session;
}
