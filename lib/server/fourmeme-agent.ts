import { getServerEnv } from "@/lib/env";

export type FourMemeAgentStatus = {
  actionNames: string[];
  agenticUrl: string;
  enabled: boolean;
  note: string | null;
};

const AGENT_ONLY_FOURMEME_ACTIONS = [
  "fourmeme.market.scan",
  "fourmeme.token.inspect",
  "fourmeme.trade.intent",
] as const;

export function getFourMemeAgentStatus(): FourMemeAgentStatus {
  const env = getServerEnv();
  const enabled = env.TIANSHI_FOURMEME_ENABLED === "true";

  return {
    actionNames: enabled ? [...AGENT_ONLY_FOURMEME_ACTIONS] : [],
    agenticUrl: env.TIANSHI_FOURMEME_AGENTIC_URL,
    enabled,
    note: enabled
      ? "Four.meme agentic skills are available as an internal BNB execution seam."
      : "Four.meme ability is disabled.",
  };
}
