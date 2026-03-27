import { createHmac } from "crypto";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";
import { buildTianezhaChatReply } from "@/lib/server/tianezha-simulation";
import { fromBase64Url, toBase64Url } from "@/lib/utils";
import { generatePublicModelText } from "@/lib/server/public-model";

export type PublicChatRole = "user" | "assistant";

export interface PublicChatMessage {
  role: PublicChatRole;
  content: string;
}

type UsagePayload = {
  stamps: number[];
};

const PUBLIC_CHAT_COOKIE = "tianshi_public_chat_usage";
const PUBLIC_CHAT_LIMIT = 20;
const PUBLIC_CHAT_WINDOW_MS = 24 * 60 * 60_000;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1_200;

function signValue(value: string) {
  return createHmac("sha256", getServerEnv().APP_SESSION_SECRET)
    .update(value)
    .digest("hex");
}

function readSignedUsageCookie(value: string | undefined) {
  if (!value) {
    return { stamps: [] } satisfies UsagePayload;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature || signValue(payload) !== signature) {
    return { stamps: [] } satisfies UsagePayload;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as UsagePayload;
    return {
      stamps: Array.isArray(parsed.stamps)
        ? parsed.stamps.filter((stamp) => Number.isFinite(stamp))
        : [],
    };
  } catch {
    return { stamps: [] } satisfies UsagePayload;
  }
}

async function readUsage() {
  const jar = await cookies();
  const raw = jar.get(PUBLIC_CHAT_COOKIE)?.value;
  const now = Date.now();
  const payload = readSignedUsageCookie(raw);

  return payload.stamps.filter((stamp) => stamp + PUBLIC_CHAT_WINDOW_MS > now);
}

async function writeUsage(stamps: number[]) {
  const jar = await cookies();
  const payload = toBase64Url(JSON.stringify({ stamps }));
  const signed = `${payload}.${signValue(payload)}`;
  jar.set(PUBLIC_CHAT_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + PUBLIC_CHAT_WINDOW_MS),
  });
}

export async function reservePublicChatTurn() {
  const stamps = await readUsage();
  if (stamps.length >= PUBLIC_CHAT_LIMIT) {
    return {
      allowed: false as const,
      remainingMessages: 0,
      resetAt: new Date(stamps[0] + PUBLIC_CHAT_WINDOW_MS).toISOString(),
    };
  }

  const nextStamps = [...stamps, Date.now()];
  await writeUsage(nextStamps);

  return {
    allowed: true as const,
    remainingMessages: Math.max(0, PUBLIC_CHAT_LIMIT - nextStamps.length),
    resetAt: new Date(nextStamps[0] + PUBLIC_CHAT_WINDOW_MS).toISOString(),
  };
}

export function sanitizePublicChatMessages(messages: PublicChatMessage[]) {
  const cleaned = messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-MAX_CONTEXT_MESSAGES);

  return cleaned;
}

function formatTranscript(messages: PublicChatMessage[]) {
  return messages
    .map((message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`,
    )
    .join("\n\n");
}

export async function generatePublicChatReply(messages: PublicChatMessage[]) {
  const cleaned = sanitizePublicChatMessages(messages);
  const latestUserMessage = [...cleaned].reverse().find((message) => message.role === "user");

  if (!latestUserMessage) {
    throw new Error("Send a message to start the chat");
  }

  const normalized = latestUserMessage.content.toLowerCase();
  if (
    normalized.includes("gmgn") ||
    normalized.includes("hyperliquid") ||
    normalized.includes("perp") ||
    normalized.includes("camiup") ||
    normalized.includes("holder tick") ||
    normalized.includes("gendelve") ||
    normalized.includes("deploy")
  ) {
    return buildTianezhaChatReply(latestUserMessage.content);
  }

  const prompt = [
    "You are Tianshi's standalone public chat panel.",
    "You are general-purpose, friendly, concise, and helpful.",
    "You must never claim to access admin systems, private agent tools, device sessions, wallets, queues, or backend controls.",
    "If asked to control private tools, explain that this chat cannot access them.",
    "Keep answers short and practical unless the user asks for depth.",
    "",
    "Conversation:",
    formatTranscript(cleaned),
    "",
    "Reply as the assistant.",
  ].join("\n");

  return generatePublicModelText(prompt, {
    temperature: 0.6,
    maxOutputTokens: 450,
  });
}
