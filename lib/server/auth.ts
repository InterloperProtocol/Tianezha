import { createHmac, randomUUID } from "crypto";
import { cookies } from "next/headers";
import bs58 from "bs58";
import nacl from "tweetnacl";

import { getServerEnv } from "@/lib/env";
import { addMinutes, addDays, fromBase64Url, nowIso, toBase64Url } from "@/lib/utils";

const NONCE_COOKIE = "tianshi_nonce";
const SESSION_COOKIE = "tianshi_session";

interface SessionPayload {
  wallet: string;
  issuedAt: string;
  expiresAt: string;
}

interface NoncePayload {
  nonce: string;
  wallet: string;
  message: string;
  expiresAt: string;
}

function signValue(value: string) {
  return createHmac("sha256", getServerEnv().APP_SESSION_SECRET)
    .update(value)
    .digest("hex");
}

export async function createAuthChallenge(wallet: string, origin: string) {
  const nonce = randomUUID();
  const expiresAt = addMinutes(new Date(), 10).toISOString();
  const message = [
    "Tianshi wallet sign-in",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Origin: ${origin}`,
    `Issued At: ${nowIso()}`,
    "This signature only creates a session. It does not move funds.",
  ].join("\n");

  const payload: NoncePayload = {
    nonce,
    wallet,
    message,
    expiresAt,
  };
  const serialized = toBase64Url(JSON.stringify(payload));
  const signed = `${serialized}.${signValue(serialized)}`;

  const jar = await cookies();
  jar.set(NONCE_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });

  return payload;
}

function readSignedCookie<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  if (signValue(payload) !== signature) return null;
  return JSON.parse(fromBase64Url(payload)) as T;
}

export async function consumeAuthChallenge(expectedWallet: string) {
  const jar = await cookies();
  const raw = jar.get(NONCE_COOKIE)?.value;
  jar.delete(NONCE_COOKIE);

  const payload = readSignedCookie<NoncePayload>(raw);
  if (!payload) throw new Error("Missing or invalid auth challenge");
  if (payload.wallet !== expectedWallet) {
    throw new Error("Wallet mismatch");
  }
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new Error("Auth challenge expired");
  }

  return payload;
}

export function verifyWalletSignature(
  wallet: string,
  message: string,
  signatureBase58: string,
) {
  const signature = bs58.decode(signatureBase58);
  const publicKey = bs58.decode(wallet);
  const messageBytes = new TextEncoder().encode(message);
  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}

export async function createWalletSession(wallet: string) {
  const payload: SessionPayload = {
    wallet,
    issuedAt: nowIso(),
    expiresAt: addDays(new Date(), 7).toISOString(),
  };
  const serialized = toBase64Url(JSON.stringify(payload));
  const signed = `${serialized}.${signValue(serialized)}`;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
    path: "/",
    expires: new Date(payload.expiresAt),
  });

  return payload;
}

export async function clearWalletSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(NONCE_COOKIE);
}

export async function getWalletSession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const payload = readSignedCookie<SessionPayload>(raw);
  if (!payload) return null;
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    jar.delete(SESSION_COOKIE);
    return null;
  }
  return payload;
}

export async function requireWalletSession() {
  const session = await getWalletSession();
  if (!session) {
    throw new Error("Authentication required");
  }
  return session;
}
