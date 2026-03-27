import { getGmgnStatus } from "@/lib/server/gmgn";

export type GmgnAgentStatus = {
  actionNames: string[];
  apiHost: string | null;
  blockedActionNames: string[];
  criticalAuthReady: boolean;
  enabled: boolean;
  note: string | null;
  standardAuthReady: boolean;
};

const AGENT_ONLY_GMGN_ACTIONS = [
  "gmgn.token.info",
  "gmgn.token.pool-info",
  "gmgn.token.security",
  "gmgn.market.rank",
  "gmgn.market.kline",
  "gmgn.market.top-traders",
  "gmgn.market.top-holders",
  "gmgn.trenches.scan",
  "gmgn.user.info",
  "gmgn.user.wallet-holdings",
  "gmgn.user.wallet-activity",
  "gmgn.user.wallet-stats",
  "gmgn.user.wallet-token-balance",
  "gmgn.trade.quote",
  "gmgn.trade.swap",
  "gmgn.trade.query-order",
] as const;

const BLOCKED_HUMAN_FACING_GMGN_ACTIONS = [
  "gmgn.public-api-key",
  "gmgn.operator-console",
] as const;

export function getGmgnAgentStatus(): GmgnAgentStatus {
  const gmgn = getGmgnStatus();

  return {
    actionNames: gmgn.sharedKeyEnabled ? [...AGENT_ONLY_GMGN_ACTIONS] : [],
    apiHost: gmgn.apiHost,
    blockedActionNames: [...BLOCKED_HUMAN_FACING_GMGN_ACTIONS],
    criticalAuthReady: gmgn.criticalAuthReady,
    enabled: gmgn.sharedKeyEnabled,
    note: gmgn.sharedKeyEnabled
      ? gmgn.criticalAuthReady
        ? "GMGN query and swap surfaces are available through Tianshi's shared key."
        : "GMGN query surfaces are available through Tianshi's shared key; swap auth is still gated."
      : "GMGN ability is disabled until the shared Tianshi API key is configured.",
    standardAuthReady: gmgn.standardAuthReady,
  };
}
