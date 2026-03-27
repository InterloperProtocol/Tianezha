import { getServerEnv } from "@/lib/env";

export type AgFundAgentStatus = {
  actionNames: string[];
  apiReady: boolean;
  enabled: boolean;
  marketplaceUrl: string;
  note: string | null;
};

const AGENT_ONLY_AGFUND_ACTIONS = [
  "agfund.agent.register",
  "agfund.agent.publish",
  "agfund.agent.memory-sync",
  "agfund.agent.messages",
] as const;

export function getAgFundAgentStatus(): AgFundAgentStatus {
  const env = getServerEnv();
  const enabled = env.TIANSHI_AGFUND_ENABLED === "true";
  const apiReady = enabled && Boolean(env.TIANSHI_AGFUND_API_KEY.trim());

  return {
    actionNames: enabled ? [...AGENT_ONLY_AGFUND_ACTIONS] : [],
    apiReady,
    enabled,
    marketplaceUrl: env.TIANSHI_AGFUND_MARKETPLACE_URL,
    note: apiReady
      ? "AgFund marketplace publishing and agent registration are configured."
      : enabled
        ? "AgFund ability is visible, but API credentials are still missing."
        : "AgFund ability is disabled.",
  };
}
