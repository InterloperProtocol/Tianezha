import { nowIso } from "@/lib/utils";

import type { PerpRiskConfig, ProfileMask, TokenWorld } from "@/lib/simulation/types";

export const ACTIVE_HEARTBEAT_AGENT_LIMIT = 42;
export const HEARTBEAT_INTERVAL_MINUTES = 1;
export const MASK_ROTATION_MINUTES = 10;
export const PREDICTION_WINDOW_MINUTES = 10;

export const PROFILE_WALL_DISCLAIMER = {
  title: "Simulation wall",
  lines: [
    "Posts on this wall are part of Tianezha's public simulation and are not proof of authorship.",
    "Anyone can play as any profile in the simulation, but rewards accrue to the canonical wallet behind the profile.",
    "Claims unlock after one verified ownership action on Solana or BNB.",
  ],
} as const;

export const FIRESTORE_SIM_COLLECTIONS = {
  agentPredictionCalls: "agentPredictionCalls",
  agentProfitShares: "agentProfitShares",
  agentTradeRequests: "agentTradeRequests",
  agentTipCommitments: "agentTipCommitments",
  agentWallets: "agentWallets",
  badgeEvents: "badgeEvents",
  botBindings: "botBindings",
  genDelveVoteIntents: "genDelveVoteIntents",
  heartbeatLeases: "heartbeatLeases",
  heartbeatTicks: "heartbeatTicks",
  identityAliases: "identityAliases",
  identityProfiles: "identityProfiles",
  loadedIdentitySessions: "loadedIdentitySessions",
  merkleSnapshots: "merkleSnapshots",
  nezhaLiquidations: "nezhaLiquidations",
  nezhaMarkets: "nezhaMarkets",
  nezhaOrders: "nezhaOrders",
  nezhaPositions: "nezhaPositions",
  raAgents: "raAgents",
  raProfileMasks: "raProfileMasks",
  rankState: "rankState",
  rewardGrants: "rewardGrants",
  rewardLedgers: "rewardLedgers",
  rewardUnlocks: "rewardUnlocks",
  polymarketMarketSnapshots: "polymarketMarketSnapshots",
  tianziPositions: "tianziPositions",
  tianziQuestions: "tianziQuestions",
  tokenWorlds: "tokenWorlds",
  userDeployedAgents: "userDeployedAgents",
  verificationEvents: "verificationEvents",
} as const;

const timestamp = nowIso();

export const TOKEN_WORLD_DEFAULTS: TokenWorld[] = [
  {
    benchmarkSymbol: "SOL",
    benchmarkTicker: "SOLUSDT",
    chain: "solana",
    contractAddress: null,
    createdAt: timestamp,
    displayName: "$CAMIUP Solana Pump World",
    governanceEnabled: true,
    id: "camiup-sol",
    launchVenue: "pump.fun",
    questionPromptLabel: "SOL-token",
    symbol: "$CAMIUP",
    totalSupply: 1_000_000_000,
    updatedAt: timestamp,
  },
  {
    benchmarkSymbol: "BNB",
    benchmarkTicker: "BNBUSDT",
    chain: "bnb",
    contractAddress: null,
    createdAt: timestamp,
    displayName: "$CAMIUP BNB Four.meme World",
    governanceEnabled: true,
    id: "camiup-bnb",
    launchVenue: "four.meme",
    questionPromptLabel: "BNB-token",
    symbol: "$CAMIUP",
    totalSupply: 1_000_000_000,
    updatedAt: timestamp,
  },
];

export const PROFILE_MASK_DEFAULTS: ProfileMask[] = [
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Posts distilled takes and quick readouts.",
    id: "analyst",
    label: "Analyst",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Baits the timeline and stirs conviction.",
    id: "troll",
    label: "Troll",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Speaks in total conviction and keeps morale high.",
    id: "believer",
    label: "Believer",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Frames everything through rates, flows, and cycle timing.",
    id: "macro-priest",
    label: "Macro Priest",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Trades in quick entries, exits, and scalp instincts.",
    id: "sniper",
    label: "Sniper",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Posts rarely but moves sentiment when they do.",
    id: "quiet-lurker",
    label: "Quiet Lurker",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Writes the longer-form thread that others quote.",
    id: "thesis-writer",
    label: "Thesis Writer",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Treats every post like a scoreboard and status game.",
    id: "whale-watcher",
    label: "Whale Watcher",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Finds the inversion and leans against consensus.",
    id: "contrarian",
    label: "Contrarian",
    updatedAt: timestamp,
  },
  {
    cadenceMinutes: MASK_ROTATION_MINUTES,
    createdAt: timestamp,
    description: "Lives in replies and keeps the room in motion.",
    id: "reply-guy",
    label: "Reply Guy",
    updatedAt: timestamp,
  },
];

export const PERP_DEFAULT_RISK_CONFIG: PerpRiskConfig = {
  backstopMargin: 0.06,
  cancelMargin: 0.12,
  highRiskMargin: 0.03,
  initialMargin: 0.2,
  maintenanceMargin: 0.1,
  maxLeverage: 5,
};

const ENS_SEEDS = [
  "atlas.eth",
  "brick.eth",
  "cinder.eth",
  "delta.eth",
  "ember.eth",
  "foundry.eth",
  "glow.eth",
  "hinge.eth",
  "ivory.eth",
  "jolt.eth",
  "knurl.eth",
  "lattice.eth",
  "merit.eth",
  "nylon.eth",
];

const SNS_SEEDS = [
  "aurora.sol",
  "bonfire.sol",
  "canopy.sol",
  "drift.sol",
  "echo.sol",
  "fable.sol",
  "golem.sol",
  "harbor.sol",
  "isobar.sol",
  "jungle.sol",
  "keystone.sol",
  "lagoon.sol",
  "murmur.sol",
  "nova.sol",
];

const BNB_SEEDS = [
  "amber.bnb",
  "bravo.bnb",
  "cobalt.bnb",
  "dawn.bnb",
  "ember.bnb",
  "flicker.bnb",
  "gild.bnb",
  "harvest.bnb",
  "ion.bnb",
  "jade.bnb",
  "kettle.bnb",
  "linen.bnb",
  "mosaic.bnb",
  "nimbus.bnb",
];

const ADDRESS_SEEDS = [
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810001",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810002",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810003",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810004",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810005",
  "7KxQJt5WJQWQ9L4djfM5cVgsA3fRw9pVQY1FQ6qBrsF7",
  "6sQq2h8AQ2w7G7H5Vr9YbZL2JYUa1svrA3P9tY2cQnTx",
  "8oUNu3n3v9A2crUeY9j6P9Wg4pDkbgYyG6pUzWyZ2jhs",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810006",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810007",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810008",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810009",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810010",
  "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810011",
];

export const RA_AGENT_SEEDS = [
  ...ENS_SEEDS,
  ...SNS_SEEDS,
  ...BNB_SEEDS,
  ...ADDRESS_SEEDS,
];
