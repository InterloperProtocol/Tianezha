import { getServerEnv } from "@/lib/env";
import { AutonomousFeedEvent } from "@/lib/types";

let setupPromise: Promise<void> | null = null;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function shouldBroadcastEvent(event: AutonomousFeedEvent) {
  return ["heartbeat", "policy", "decision", "trade", "revenue", "burn"].includes(
    event.kind,
  );
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function getTelegramConfig() {
  const env = getServerEnv();
  return {
    token: env.GOONCLAW_TELEGRAM_BOT_TOKEN,
    chatId: env.GOONCLAW_TELEGRAM_CHAT_ID,
    threadId: env.GOONCLAW_TELEGRAM_THREAD_ID,
    description: env.GOONCLAW_TELEGRAM_DESCRIPTION,
    shortDescription: env.GOONCLAW_TELEGRAM_SHORT_DESCRIPTION,
  };
}

function canUseTelegram() {
  const config = getTelegramConfig();
  return Boolean(config.token && config.chatId);
}

async function callTelegramApi(
  method: string,
  payload: Record<string, unknown> = {},
) {
  const { token } = getTelegramConfig();
  if (!token) {
    return null;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram ${method} failed: ${text || response.statusText}`);
  }

  return response.json();
}

async function ensureReadOnlyBotSetup() {
  if (setupPromise) {
    return setupPromise;
  }

  const config = getTelegramConfig();
  if (!config.token) {
    return;
  }

  setupPromise = (async () => {
    await callTelegramApi("deleteWebhook", {
      drop_pending_updates: false,
    }).catch(() => null);
    await callTelegramApi("deleteMyCommands").catch(() => null);
    await callTelegramApi("setMyDescription", {
      description: config.description,
    }).catch(() => null);
    await callTelegramApi("setMyShortDescription", {
      short_description: config.shortDescription,
    }).catch(() => null);
  })();

  await setupPromise;
}

function formatEventMessage(event: AutonomousFeedEvent) {
  const lines = [
    `<b>GoonClaw ${escapeHtml(event.kind)}</b>`,
    `<b>${escapeHtml(event.title)}</b>`,
    escapeHtml(event.detail),
  ];

  if (event.rawTrace.length) {
    lines.push("");
    lines.push("<b>Trace</b>");
    for (const trace of event.rawTrace.slice(0, 8)) {
      lines.push(`- ${escapeHtml(trace)}`);
    }
  }

  return truncate(lines.join("\n"), 3900);
}

export function isGoonclawTelegramBroadcastEnabled() {
  return canUseTelegram();
}

export async function bootstrapGoonclawTelegramBot() {
  const { token } = getTelegramConfig();
  if (!token) {
    return false;
  }

  await ensureReadOnlyBotSetup();
  return true;
}

export async function publishAutonomousEventToTelegram(event: AutonomousFeedEvent) {
  if (!canUseTelegram() || !shouldBroadcastEvent(event)) {
    return false;
  }

  const config = getTelegramConfig();
  await ensureReadOnlyBotSetup();

  await callTelegramApi("sendMessage", {
    chat_id: config.chatId,
    message_thread_id: config.threadId ? Number(config.threadId) : undefined,
    text: formatEventMessage(event),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  return true;
}
