import { getServerEnv } from "@/lib/env";

export type GodmodeAgentStatus = {
  actionNames: string[];
  apiBaseUrl: string | null;
  apiReady: boolean;
  blockedActionNames: string[];
  defaultModel: string;
  enabled: boolean;
  note: string | null;
};

const AGENT_ONLY_GODMODE_ACTIONS = [
  "godmode.chat",
  "godmode.models",
  "godmode.ultraplinian",
  "godmode.autotune",
] as const;

const BLOCKED_HUMAN_FACING_GODMODE_ACTIONS = [
  "godmode.public-ui",
  "godmode.browser-console",
] as const;

let cachedProbe:
  | {
      checkedAtMs: number;
      note: string | null;
      ready: boolean;
    }
  | null = null;

function buildGodmodeHeaders() {
  const env = getServerEnv();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (env.TIANSHI_GODMODE_API_KEY.trim()) {
    headers.Authorization = `Bearer ${env.TIANSHI_GODMODE_API_KEY.trim()}`;
  }

  return headers;
}

export function getGodmodeAgentStatus(): GodmodeAgentStatus {
  const env = getServerEnv();
  const enabled = env.TIANSHI_GODMODE_ENABLED === "true";
  const apiBaseUrl = env.TIANSHI_GODMODE_API_URL.trim() || null;
  const ready = enabled && Boolean(apiBaseUrl) && Boolean(cachedProbe?.ready);

  return {
    actionNames: enabled && apiBaseUrl ? [...AGENT_ONLY_GODMODE_ACTIONS] : [],
    apiBaseUrl,
    apiReady: ready,
    blockedActionNames: [...BLOCKED_HUMAN_FACING_GODMODE_ACTIONS],
    defaultModel: env.TIANSHI_GODMODE_DEFAULT_MODEL,
    enabled,
    note: cachedProbe?.note ?? null,
  };
}

export async function warmGodmodeAgentAbility() {
  const env = getServerEnv();
  if (env.TIANSHI_GODMODE_ENABLED !== "true") {
    cachedProbe = {
      checkedAtMs: Date.now(),
      note: "G0DM0D3 is disabled.",
      ready: false,
    };
    return cachedProbe;
  }

  if (!env.TIANSHI_GODMODE_API_URL.trim()) {
    cachedProbe = {
      checkedAtMs: Date.now(),
      note: "Missing TIANSHI_GODMODE_API_URL.",
      ready: false,
    };
    return cachedProbe;
  }

  if (cachedProbe && Date.now() - cachedProbe.checkedAtMs < 5 * 60_000) {
    return cachedProbe;
  }

  try {
    const response = await fetch(
      `${env.TIANSHI_GODMODE_API_URL.replace(/\/$/, "")}/v1/models`,
      {
        headers: buildGodmodeHeaders(),
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    cachedProbe = {
      checkedAtMs: Date.now(),
      note: `Model catalog reachable. Default model ${env.TIANSHI_GODMODE_DEFAULT_MODEL}.`,
      ready: true,
    };
  } catch (error) {
    cachedProbe = {
      checkedAtMs: Date.now(),
      note: error instanceof Error ? error.message : "Probe failed.",
      ready: false,
    };
  }

  return cachedProbe;
}

