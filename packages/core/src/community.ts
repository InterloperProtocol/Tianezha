import type { CommunityConfig, RewardPoolPolicy } from "@/packages/core/src/protocol";

const DEFAULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export const DEFAULT_REWARD_POOL_POLICY: RewardPoolPolicy = {
  totalRewardsPoolPct: 49,
  tokenHolderProportionalPct: 51,
  proofOfComputePct: 21,
  userRewardPct: 28,
};

function nowIso() {
  return new Date().toISOString();
}

export function validateRewardPoolPolicy(policy: RewardPoolPolicy) {
  const laneTotal =
    policy.tokenHolderProportionalPct +
    policy.proofOfComputePct +
    policy.userRewardPct;

  if (policy.totalRewardsPoolPct !== 49) {
    throw new Error("Tianezha rewards reserve exactly 49% for the total rewards pool.");
  }

  if (laneTotal !== 100) {
    throw new Error("Reward pool lane percentages must sum to 100.");
  }

  return policy;
}

export function validateCommunityConfig(config: CommunityConfig) {
  if (config.bootstrapMintAddresses.length < 1 || config.bootstrapMintAddresses.length > 2) {
    throw new Error("Community bootstrap requires one or two mint addresses.");
  }

  if (!config.localFirst) {
    throw new Error("Tianezha communities must remain local-first.");
  }

  if (config.walletConnectRequired) {
    throw new Error("Baseline Tianezha node operation may not require wallet connect.");
  }

  if (!config.savegameRequired) {
    throw new Error("Savegame continuity is mandatory for Tianezha communities.");
  }

  validateRewardPoolPolicy(config.rewardPoolPolicy);
  return config;
}

export function createCommunityConfig(
  input: Partial<CommunityConfig> & {
    id: string;
    label: string;
    bootstrapMintAddresses: string[];
  },
): CommunityConfig {
  const timestamp = input.createdAt || input.updatedAt || nowIso();

  return validateCommunityConfig({
    bootstrapMintAddresses: input.bootstrapMintAddresses.map((value) => value.trim()).filter(Boolean),
    createdAt: input.createdAt || timestamp || DEFAULT_TIMESTAMP,
    id: input.id,
    label: input.label,
    localFirst: input.localFirst ?? true,
    paymentAdapters: input.paymentAdapters ?? [
      "x402",
      "manual_invoice",
      "solana_memo",
      "btc_watcher",
      "xmr_watcher",
    ],
    relayFallbackEnabled: input.relayFallbackEnabled ?? true,
    rewardPoolPolicy: input.rewardPoolPolicy ?? DEFAULT_REWARD_POOL_POLICY,
    savegameRequired: input.savegameRequired ?? true,
    updatedAt: input.updatedAt || timestamp || DEFAULT_TIMESTAMP,
    walletConnectRequired: input.walletConnectRequired ?? false,
  });
}

export function bootstrapCommunityFromMintAddresses(
  bootstrapMintAddresses: string[],
  overrides?: Partial<CommunityConfig>,
) {
  return createCommunityConfig({
    bootstrapMintAddresses,
    id: overrides?.id || "tianezha-default-community",
    label: overrides?.label || "Tianezha Community",
    ...overrides,
  });
}
