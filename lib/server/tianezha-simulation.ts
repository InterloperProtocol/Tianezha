import { randomUUID } from "crypto";

import { Keypair } from "@solana/web3.js";
import { Wallet } from "ethers";

import {
  getBitClawFeed,
  listBitClawProfiles as listDecoratedBitClawProfiles,
} from "@/lib/server/bitclaw";
import { getAgFundAgentStatus } from "@/lib/server/agfund-agent";
import { getDexterAgentStatus } from "@/lib/server/dexter-agent";
import { getServerEnv } from "@/lib/env";
import { getFourMemeAgentStatus } from "@/lib/server/fourmeme-agent";
import { getGmgnStatus } from "@/lib/server/gmgn";
import { getGodmodeAgentStatus } from "@/lib/server/godmode-agent";
import {
  getHyperliquidAgentStatus,
  warmHyperliquidAgentAbility,
} from "@/lib/server/hyperliquid-agent";
import {
  fetchPolymarketMarkets,
  getPolymarketAgentStatus,
} from "@/lib/server/polymarket-agent";
import { getAutonomousReportCommercePolicy } from "@/lib/server/autonomous-treasury-policy";
import { getBenchmarkQuotes, getTokenWorldQuote } from "@/lib/server/tianezha-market-data";
import {
  getSimulationOwnerWallet,
  simDelete,
  simFindOne,
  simFilter,
  simGet,
  simList,
  simUpsert,
} from "@/lib/server/tianezha-sim-store";
import {
  getBitClawProfile as getStoredBitClawProfile,
  listBitClawPosts,
  upsertBitClawPost,
  upsertBitClawProfile,
} from "@/lib/server/repository";
import {
  getLoadedIdentityCookie,
  setLoadedIdentityCookie,
} from "@/lib/server/loaded-identity";
import { verifyMemoTransferToTreasury } from "@/lib/server/solana";
import {
  getBnbVerificationTarget,
  getBnbTokenBalance,
  getSolanaVerificationTarget,
  getSolanaTokenBalance,
  verifyBnbTokenTransferToTarget,
  verifyBnbMemoTransaction,
  verifySolanaTokenTransferToTarget,
} from "@/lib/server/tianezha-chain-data";
import {
  ACTIVE_HEARTBEAT_AGENT_LIMIT,
  FIRESTORE_SIM_COLLECTIONS,
  HEARTBEAT_INTERVAL_MINUTES,
  PERP_DEFAULT_RISK_CONFIG,
  PREDICTION_WINDOW_MINUTES,
  PROFILE_MASK_DEFAULTS,
  PROFILE_WALL_DISCLAIMER,
  RA_AGENT_SEEDS,
  TOKEN_WORLD_DEFAULTS,
} from "@/lib/simulation/constants";
import {
  buildBitClawHandle,
  buildIdentityProfileId,
  detectChainFamily,
  normalizeAddressInput,
  shortenAddress,
} from "@/lib/simulation/identity";
import {
  categorizeBadge,
  deriveRankLabel,
  deriveRankNumber,
  HYBRID_FUTARCHY_WEIGHTS,
  PERCOLATOR_SAFE_COMPETITIVE_BUDGET,
} from "@/lib/simulation/meta";
import { buildMerkleSnapshot, createMerkleRoot } from "@/lib/simulation/merkle";
import type {
  AgentTradeRequest,
  AgentTradeRequestKind,
  AgentPredictionCall,
  AgentProfitShareRecord,
  AgentTipCommitment,
  AgentWalletRecord,
  BadgeEvent,
  BotBinding,
  GenDelveVoteIntent,
  Heartbeat42Snapshot,
  HeartbeatLease,
  HolderDeployedAgent,
  HybridFutarchyState,
  IdentityAlias,
  IdentityProfile,
  LoadedIdentity,
  MerkleSnapshotRecord,
  PercolatorState,
  PolymarketMarketSnapshot,
  PredictionBook,
  PredictionPosition,
  PredictionQuestion,
  PasteTradeIntegration,
  ProfileOwnerChallenge,
  ProfileMask,
  ProfileVerificationState,
  RAAgentIdentity,
  RankStateRecord,
  RewardGrantEvent,
  RewardLedger,
  RewardUnlockReason,
  RewardUnlockState,
  SimPerpLiquidation,
  SimPerpMarket,
  SimPerpOrder,
  SimPerpPosition,
  SimulationBalance,
  TokenWorld,
  VerifiedHolderWorld,
  VerificationEvent,
} from "@/lib/simulation/types";
import type { BitClawPost, BitClawPostRecord, BitClawProfile } from "@/lib/types";
import { addMinutes, clamp, nowIso, seededNumber, sha256Hex } from "@/lib/utils";

type LoadedIdentitySessionRecord = {
  id: string;
  loadedAt: string;
  profileId: string;
  sourceInput: string;
};

type SharedGmgnCapability = {
  apiHost: string | null;
  criticalAuthReady: boolean;
  queryChains: string[];
  sharedKeyEnabled: boolean;
  toolFamilies: string[];
  tradingWallet: string | null;
};

type SharedHyperliquidCapability = {
  apiUrl: string | null;
  apiWalletAddress: string | null;
  apiWalletApproved: boolean;
  defaultDex: string | null;
  enabled: boolean;
  infoReady: boolean;
  livePerpsEnabled: boolean;
  masterWalletAddress: string | null;
  wsUrl: string | null;
};

const PASTE_TRADE_REPO_URL = "https://github.com/rohunvora/paste-trade";
const PASTE_TRADE_BOARD_URL = "https://paste.trade";

function getPasteTradeIntegration(profile?: Pick<BitClawProfile, "handle"> | null) {
  const handle = profile?.handle?.trim() || "tianshi";

  return {
    boardUrl: PASTE_TRADE_BOARD_URL,
    note:
      "Paste.trade stays upstream for thesis extraction and tracking. Tianezha uses it as a request and research surface, while execution remains inside the local risk plane.",
    predictionVenue: "polymarket",
    repoUrl: PASTE_TRADE_REPO_URL,
    supportedVenues: ["Hyperliquid", "Robinhood", "Polymarket"],
    tradeCommandExample: `/trade https://x.com/${handle}/status/123456789`,
    updateCommandExample: "/trade update",
  } satisfies PasteTradeIntegration;
}

function getSharedGmgnCapability(): SharedGmgnCapability {
  const gmgn = getGmgnStatus();
  return {
    apiHost: gmgn.apiHost,
    criticalAuthReady: gmgn.criticalAuthReady,
    queryChains: [...gmgn.queryChains],
    sharedKeyEnabled: gmgn.sharedKeyEnabled,
    toolFamilies: [...gmgn.toolFamilies],
    tradingWallet: gmgn.tradingWallet,
  };
}

function getSharedHyperliquidCapability(): SharedHyperliquidCapability {
  const hyperliquid = getHyperliquidAgentStatus();
  return {
    apiUrl: hyperliquid.apiUrl,
    apiWalletAddress: hyperliquid.apiWalletAddress,
    apiWalletApproved: hyperliquid.apiWalletApproved,
    defaultDex: hyperliquid.defaultDex,
    enabled: hyperliquid.enabled,
    infoReady: hyperliquid.infoReady,
    livePerpsEnabled: hyperliquid.livePerpsEnabled,
    masterWalletAddress: hyperliquid.masterWalletAddress,
    wsUrl: hyperliquid.wsUrl,
  };
}

export type BitClawWallState = {
  agentState: {
    gmgn: SharedGmgnCapability;
    hyperliquid: SharedHyperliquidCapability;
    pasteTrade: PasteTradeIntegration;
    predictionCalls: AgentPredictionCall[];
    profitShares: AgentProfitShareRecord[];
    tradeRequests: AgentTradeRequest[];
    tipCommitments: AgentTipCommitment[];
    wallets: AgentWalletRecord[];
  } | null;
  disclaimer: {
    lines: string[];
    title: string;
  };
  posts: BitClawPost[];
  profile: BitClawProfile | null;
  rewardLedger: RewardLedger | null;
  rewardUnlock: RewardUnlockState | null;
  verification: ProfileVerificationState | null;
  wallProfileId: string;
};

export type BitClawMainState = {
  feed: BitClawPost[];
  hyperliquid: SharedHyperliquidCapability;
  loadedIdentity: LoadedIdentity | null;
  pasteTrade: PasteTradeIntegration;
  profiles: BitClawProfile[];
  recentRequests: AgentTradeRequest[];
};

export type HeartbeatAgentCard = {
  agent: RAAgentIdentity;
  mask: ProfileMask | null;
  predictionCalls: AgentPredictionCall[];
  profile: BitClawProfile | null;
  wallets: AgentWalletRecord[];
};

export type HeartbeatState = {
  merkleSnapshots: MerkleSnapshotRecord[];
  hyperliquid: SharedHyperliquidCapability;
  polymarketMarkets: PolymarketMarketSnapshot[];
  recentFeed: BitClawPost[];
  snapshot: Heartbeat42Snapshot;
  agents: HeartbeatAgentCard[];
};

export type TianziState = {
  book: PredictionBook;
  profilePositions: PredictionPosition[];
  question: PredictionQuestion;
  recentQuestions: PredictionQuestion[];
  worldQuotes: Array<{
    priceUsd: number;
    world: TokenWorld;
  }>;
};

export type NezhaState = {
  liquidations: SimPerpLiquidation[];
  markets: SimPerpMarket[];
  orders: SimPerpOrder[];
  positions: SimPerpPosition[];
};

export type GenDelveState = {
  intents: GenDelveVoteIntent[];
  ownerChallenge: ProfileOwnerChallenge | null;
  worlds: TokenWorld[];
};

export type BolClawState = {
  activeMasks: HeartbeatState["agents"];
  feed: BitClawPost[];
  loadedIdentity: LoadedIdentity | null;
  nezha: NezhaState;
  pasteTrade: PasteTradeIntegration;
  recentRequests: AgentTradeRequest[];
  tianzi: TianziState;
  trendingProfiles: BitClawProfile[];
  worlds: TianziState["worldQuotes"];
};

export type TianshiDiagnosticsState = {
  agentAbilities: Array<{
    detail: string;
    label: string;
    status: string;
  }>;
  botBindings: BotBinding[];
  diagnostics: Array<{
    label: string;
    value: string;
  }>;
  heartbeat: HeartbeatState;
  hybridFutarchy: HybridFutarchyState;
  loadedIdentity: LoadedIdentity | null;
  merkleSnapshots: MerkleSnapshotRecord[];
  percolator: PercolatorState;
  polymarketMarkets: PolymarketMarketSnapshot[];
};

type RewardDeltaOptions = {
  badge?: string;
  reason?: string;
};

function getSimulationHandle(label: string) {
  const normalized = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `#ID-${normalized.slice(0, 18) || "PROFILE"}`;
}

function isHexWallet(value: string) {
  return /^0x[a-f0-9]{40}$/i.test(value.trim());
}

function getSupportedGovernanceChain(profile: IdentityProfile) {
  if (profile.chain === "solana") {
    return "solana" as const;
  }

  if ((profile.chain === "bnb" || profile.chain === "ethereum") && isHexWallet(profile.ownerWallet)) {
    return "bnb" as const;
  }

  return null;
}

function getWorldEnvAddress(worldId: string) {
  if (worldId === "camiup-sol") {
    return process.env.TIANEZHA_SOL_TOKEN_ADDRESS?.trim() || null;
  }

  if (worldId === "camiup-bnb") {
    return process.env.TIANEZHA_BNB_TOKEN_ADDRESS?.trim() || null;
  }

  return null;
}

function getWorldVerificationTarget(world: Pick<TokenWorld, "chain">) {
  return world.chain === "solana"
    ? getSolanaVerificationTarget()
    : getBnbVerificationTarget();
}

function isHolderVerificationReason(reason: RewardUnlockReason) {
  return reason === "camiup_transfer" || reason === "gendelve_vote";
}

function buildAgentName(seed: string, index: number) {
  const base = seed
    .replace(/\.(eth|sol|bnb)$/i, "")
    .replace(/^0x/i, "")
    .slice(0, 12)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `RA-${(base || `agent-${index + 1}`).toUpperCase()}`;
}

function buildAgentProfileId(agentId: string) {
  return `agent:${agentId}`;
}

function isAgentProfileId(profileId: string) {
  return profileId.startsWith("agent:");
}

function getAgentWalletSeedMaterial(agentId: string, chain: string) {
  const env = getServerEnv();
  const rootSecret =
    env.TIANSHI_AGENT_WALLET_SECRET.trim() ||
    env.APP_SESSION_SECRET.trim() ||
    "tianezha-agent-wallets";

  return sha256Hex(`${rootSecret}:${agentId}:${chain}`);
}

function deriveAgentWalletAddress(
  agentId: string,
  chain: AgentWalletRecord["chain"],
) {
  const seedHex = getAgentWalletSeedMaterial(agentId, chain);
  if (chain === "solana") {
    return Keypair.fromSeed(Uint8Array.from(Buffer.from(seedHex, "hex")))
      .publicKey.toBase58();
  }

  return new Wallet(`0x${seedHex}`).address;
}

function buildAgentWalletRecords(agent: RAAgentIdentity) {
  const profileId = buildAgentProfileId(agent.id);
  const timestamp = nowIso();

  return [
    {
      address: deriveAgentWalletAddress(agent.id, "solana"),
      agentId: agent.id,
      assignedBy: "tianshi",
      chain: "solana",
      createdAt: timestamp,
      id: `agent-wallet:${agent.id}:solana`,
      isPublic: true,
      profileId,
      purpose: "dexter-sniping",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(agent.id, "polygon"),
      agentId: agent.id,
      assignedBy: "tianshi",
      chain: "polygon",
      createdAt: timestamp,
      id: `agent-wallet:${agent.id}:polygon`,
      isPublic: true,
      profileId,
      purpose: "prediction-markets",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(agent.id, "bnb"),
      agentId: agent.id,
      assignedBy: "tianshi",
      chain: "bnb",
      createdAt: timestamp,
      id: `agent-wallet:${agent.id}:bnb`,
      isPublic: true,
      profileId,
      purpose: "bnb-execution",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(agent.id, "ethereum"),
      agentId: agent.id,
      assignedBy: "tianshi",
      chain: "ethereum",
      createdAt: timestamp,
      id: `agent-wallet:${agent.id}:hyperliquid`,
      isPublic: true,
      profileId,
      purpose: "hyperliquid-perps",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(agent.id, "ethereum"),
      agentId: agent.id,
      assignedBy: "tianshi",
      chain: "ethereum",
      createdAt: timestamp,
      id: `agent-wallet:${agent.id}:ethereum`,
      isPublic: true,
      profileId,
      purpose: "settlement",
      updatedAt: timestamp,
    },
  ] satisfies AgentWalletRecord[];
}

function buildHolderDeployedAgentWalletRecords(args: {
  agentId: string;
  profileId: string;
}) {
  const timestamp = nowIso();

  return [
    {
      address: deriveAgentWalletAddress(args.agentId, "solana"),
      agentId: args.agentId,
      assignedBy: "tianshi",
      chain: "solana",
      createdAt: timestamp,
      id: `holder-agent-wallet:${args.agentId}:solana`,
      isPublic: true,
      profileId: args.profileId,
      purpose: "dexter-sniping",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(args.agentId, "bnb"),
      agentId: args.agentId,
      assignedBy: "tianshi",
      chain: "bnb",
      createdAt: timestamp,
      id: `holder-agent-wallet:${args.agentId}:bnb`,
      isPublic: true,
      profileId: args.profileId,
      purpose: "bnb-execution",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(args.agentId, "polygon"),
      agentId: args.agentId,
      assignedBy: "tianshi",
      chain: "polygon",
      createdAt: timestamp,
      id: `holder-agent-wallet:${args.agentId}:polygon`,
      isPublic: true,
      profileId: args.profileId,
      purpose: "prediction-markets",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(args.agentId, "ethereum"),
      agentId: args.agentId,
      assignedBy: "tianshi",
      chain: "ethereum",
      createdAt: timestamp,
      id: `holder-agent-wallet:${args.agentId}:hyperliquid`,
      isPublic: true,
      profileId: args.profileId,
      purpose: "hyperliquid-perps",
      updatedAt: timestamp,
    },
    {
      address: deriveAgentWalletAddress(args.agentId, "ethereum"),
      agentId: args.agentId,
      assignedBy: "tianshi",
      chain: "ethereum",
      createdAt: timestamp,
      id: `holder-agent-wallet:${args.agentId}:ethereum`,
      isPublic: true,
      profileId: args.profileId,
      purpose: "settlement",
      updatedAt: timestamp,
    },
  ] satisfies AgentWalletRecord[];
}

async function ensureAgentWallets(agent: RAAgentIdentity) {
  return Promise.all(
    buildAgentWalletRecords(agent).map((record) =>
      simUpsert(FIRESTORE_SIM_COLLECTIONS.agentWallets, record),
    ),
  );
}

async function listAgentWallets(profileId?: string | null) {
  return simFilter<AgentWalletRecord>(
    FIRESTORE_SIM_COLLECTIONS.agentWallets,
    (record) => !profileId || record.profileId === profileId,
  );
}

async function listAgentPredictionCalls(profileId?: string | null) {
  const records = await simFilter<AgentPredictionCall>(
    FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls,
    (record) => !profileId || record.profileId === profileId,
  );

  return records
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function listAgentTradeRequests(profileId?: string | null) {
  const records = await simFilter<AgentTradeRequest>(
    FIRESTORE_SIM_COLLECTIONS.agentTradeRequests,
    (record) => !profileId || record.profileId === profileId,
  );

  return records
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function listAgentTipCommitments(profileId?: string | null) {
  const records = await simFilter<AgentTipCommitment>(
    FIRESTORE_SIM_COLLECTIONS.agentTipCommitments,
    (record) => !profileId || record.profileId === profileId,
  );

  return records
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function listAgentProfitShares(profileId?: string | null) {
  const records = await simFilter<AgentProfitShareRecord>(
    FIRESTORE_SIM_COLLECTIONS.agentProfitShares,
    (record) => !profileId || record.profileId === profileId,
  );

  return records
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function listHolderDeployedAgents(profileId?: string | null) {
  const records = await simFilter<HolderDeployedAgent>(
    FIRESTORE_SIM_COLLECTIONS.userDeployedAgents,
    (record) => !profileId || record.ownerProfileId === profileId,
  );

  return records
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function convictionFromScore(score: number): AgentPredictionCall["conviction"] {
  if (score >= 0.8 || score <= 0.2) {
    return "high";
  }
  if (score >= 0.65 || score <= 0.35) {
    return "medium";
  }
  return "low";
}

function normalizeTradeRequestTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 96);
}

function normalizeTradeRequestBody(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 600);
}

function normalizeOptionalSourceUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Trade request source URLs must use http or https.");
    }

    parsed.hash = "";
    return parsed.toString();
  } catch {
    throw new Error("Trade request source URLs must be valid absolute URLs.");
  }
}

function buildVerifiedHolderWorlds(args: {
  balances: SimulationBalance[];
  verificationEvents: VerificationEvent[];
  worlds: TokenWorld[];
}) {
  const worldById = new Map(args.worlds.map((world) => [world.id, world]));
  const latestVerificationByWorld = new Map<string, VerificationEvent>();

  for (const event of args.verificationEvents) {
    if (!event.worldId || !isHolderVerificationReason(event.reason)) {
      continue;
    }

    const existing = latestVerificationByWorld.get(event.worldId);
    if (!existing || existing.createdAt < event.createdAt) {
      latestVerificationByWorld.set(event.worldId, event);
    }
  }

  return args.balances
    .map((balance) => {
      const world = worldById.get(balance.worldId);
      if (!world || (world.chain !== "solana" && world.chain !== "bnb")) {
        return null;
      }

      const verificationEvent = latestVerificationByWorld.get(world.id);

      return {
        actualHoldings: balance.actualHoldings,
        actualHoldingsSource: balance.actualHoldingsSource,
        chain: world.chain,
        isEligible: Boolean(verificationEvent),
        launchVenue: world.launchVenue,
        symbol: world.symbol,
        verificationTarget:
          verificationEvent?.verificationTarget || getWorldVerificationTarget(world),
        verificationTransactionId: verificationEvent?.transactionId ?? null,
        verifiedAt: verificationEvent?.createdAt ?? null,
        worldId: world.id,
      } satisfies VerifiedHolderWorld;
    })
    .filter(Boolean) as VerifiedHolderWorld[];
}

function getRewardUnlockVerificationState(
  args: {
    balances: SimulationBalance[];
    profileId: string;
    rewardUnlock: RewardUnlockState;
    verificationEvents: VerificationEvent[];
    worlds: TokenWorld[];
  },
): ProfileVerificationState {
  const verifiedHolderWorlds = buildVerifiedHolderWorlds({
    balances: args.balances,
    verificationEvents: args.verificationEvents,
    worlds: args.worlds,
  }).filter((world) => world.isEligible);
  const verifiedHolderChains = [...new Set(verifiedHolderWorlds.map((world) => world.chain))];
  const verifiedHolderWorldIds = verifiedHolderWorlds.map((world) => world.worldId);
  const hasEligibleCamiupHolding = verifiedHolderWorldIds.length > 0;
  const latestHolderVerificationAt =
    verifiedHolderWorlds
      .map((world) => world.verifiedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    canDeployAgent: hasEligibleCamiupHolding,
    hasEligibleCamiupHolding,
    holderVerificationMode: "camiup_transfer",
    holderVerificationTargets: {
      bnb: getBnbVerificationTarget(),
      solana: getSolanaVerificationTarget(),
    },
    isVerifiedOwner: args.rewardUnlock.claimsUnlocked,
    lastVerifiedActionAt:
      [args.rewardUnlock.lastVerifiedActionAt, latestHolderVerificationAt]
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
    profileId: args.profileId,
    verificationTick: hasEligibleCamiupHolding,
    verifiedActionCount: args.rewardUnlock.verifiedActionCount,
    verifiedHolderChains,
    verifiedHolderWorldIds,
    verifiedHolderWorlds,
  };
}

async function ensureTokenWorlds() {
  const existing = await simList<TokenWorld>(FIRESTORE_SIM_COLLECTIONS.tokenWorlds);
  if (existing.length) {
    const updated = await Promise.all(
      existing.map(async (world) => {
        const envAddress = getWorldEnvAddress(world.id);
        if (envAddress && envAddress !== world.contractAddress) {
          return simUpsert(FIRESTORE_SIM_COLLECTIONS.tokenWorlds, {
            ...world,
            contractAddress: envAddress,
            updatedAt: nowIso(),
          });
        }

        return world;
      }),
    );

    return updated.sort((left, right) => left.id.localeCompare(right.id));
  }

  const seeded = await Promise.all(
    TOKEN_WORLD_DEFAULTS.map((world) =>
      simUpsert(FIRESTORE_SIM_COLLECTIONS.tokenWorlds, {
        ...world,
        contractAddress: getWorldEnvAddress(world.id) || world.contractAddress,
      }),
    ),
  );

  return seeded.sort((left, right) => left.id.localeCompare(right.id));
}

async function ensureRewardLedger(profileId: string) {
  const existing = await simGet<RewardLedger>(FIRESTORE_SIM_COLLECTIONS.rewardLedgers, profileId);
  if (existing) {
    return existing;
  }

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.rewardLedgers, {
    availableRewards: 0,
    badges: [],
    id: profileId,
    lockedRewards: 0,
    pendingRewards: 0,
    profileId,
    rank: 1,
    streak: 0,
    totalRewards: 0,
    updatedAt: nowIso(),
  } satisfies RewardLedger);
}

async function ensureRewardUnlock(profileId: string) {
  const existing = await simGet<RewardUnlockState>(
    FIRESTORE_SIM_COLLECTIONS.rewardUnlocks,
    profileId,
  );
  if (existing) {
    return existing;
  }

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.rewardUnlocks, {
    claimsUnlocked: false,
    id: profileId,
    profileId,
    reason: "locked",
    requiresGovernanceParticipation: true,
    updatedAt: nowIso(),
    verifiedActionCount: 0,
  } satisfies RewardUnlockState);
}

async function syncHumanBitClawProfile(identityProfile: IdentityProfile) {
  const rewardUnlock = await ensureRewardUnlock(identityProfile.id);
  const [balances, verificationEvents, worlds] = await Promise.all([
    buildSimulationBalances(identityProfile.id),
    listVerificationEvents(identityProfile.id),
    ensureTokenWorlds(),
  ]);
  const verification = getRewardUnlockVerificationState({
    balances,
    profileId: identityProfile.id,
    rewardUnlock,
    verificationEvents,
    worlds,
  });
  const existing = await getStoredBitClawProfile(identityProfile.bitClawProfileId);
  const timestamp = nowIso();

  return upsertBitClawProfile({
    accentLabel: identityProfile.chain.toUpperCase(),
    authType: "guest",
    authorType: "human",
    avatarUrl: existing?.avatarUrl || null,
    bio:
      existing?.bio ||
      `Open public simulation wall for ${identityProfile.displayName}. Posts here are not proof of authorship.`,
    createdAt: existing?.createdAt || timestamp,
    displayName: identityProfile.displayName,
    followerCount: existing?.followerCount ?? 0,
    followingCount: existing?.followingCount ?? 0,
    guestId: identityProfile.id,
    handle: existing?.handle || buildBitClawHandle(identityProfile.publicLabel),
    id: identityProfile.bitClawProfileId,
    isAutonomous: false,
    pasteTradeBoardUrl: PASTE_TRADE_BOARD_URL,
    pasteTradeRepoUrl: PASTE_TRADE_REPO_URL,
    predictionRequestLabel: "Prediction-market requests",
    subscriptionLabel: verification.canDeployAgent
      ? "Verified $CAMIUP holder"
      : rewardUnlock.claimsUnlocked
        ? "Verified owner"
        : "Open simulation wall",
    updatedAt: timestamp,
  } satisfies BitClawProfile);
}

async function ensureRaMasks() {
  const existing = await simList<ProfileMask>(FIRESTORE_SIM_COLLECTIONS.raProfileMasks);
  if (existing.length) {
    return existing;
  }

  return Promise.all(
    PROFILE_MASK_DEFAULTS.map((mask) =>
      simUpsert(FIRESTORE_SIM_COLLECTIONS.raProfileMasks, mask),
    ),
  );
}

async function ensureRaAgents() {
  const existing = await simList<RAAgentIdentity>(FIRESTORE_SIM_COLLECTIONS.raAgents);
  if (existing.length >= ACTIVE_HEARTBEAT_AGENT_LIMIT) {
    await Promise.all(
      existing.map((agent) =>
        Promise.all([
          ensureAgentWallets(agent),
          ensureRewardLedger(buildAgentProfileId(agent.id)),
          ensureRewardUnlock(buildAgentProfileId(agent.id)),
        ]),
      ),
    );
    return existing;
  }

  const seededAgents = await Promise.all(
    RA_AGENT_SEEDS.map(async (seed, index) => {
      const id = `ra:${sha256Hex(seed).slice(0, 14)}`;
      const canonicalName = buildAgentName(seed, index);
      const agent = await simUpsert(FIRESTORE_SIM_COLLECTIONS.raAgents, {
        canonicalName,
        chainAffinity: detectChainFamily(seed),
        createdAt: nowIso(),
        id,
        simulationHandle: `#${canonicalName}`,
        sourceKind: seed.endsWith(".eth")
          ? "ens"
          : seed.endsWith(".sol")
            ? "sns"
            : seed.endsWith(".bnb")
              ? "spaceid"
              : "address",
        updatedAt: nowIso(),
      } satisfies RAAgentIdentity);

      const profileId = buildAgentProfileId(agent.id);
      await upsertBitClawProfile({
        accentLabel: "RA social agent",
        authType: "system",
        authorType: "agent",
        avatarUrl: null,
        bio: `${canonicalName} rotates masks inside the Tianezha public simulation.`,
        createdAt: agent.createdAt,
        displayName: canonicalName,
        guestId: agent.id,
        handle: buildBitClawHandle(canonicalName),
        id: profileId,
        isAutonomous: true,
        pasteTradeBoardUrl: PASTE_TRADE_BOARD_URL,
        pasteTradeRepoUrl: PASTE_TRADE_REPO_URL,
        predictionRequestLabel: "Polygon prediction requests",
        subscriptionLabel: "42-agent heartbeat",
        updatedAt: agent.updatedAt,
      } satisfies BitClawProfile);
      await Promise.all([
        ensureAgentWallets(agent),
        ensureRewardLedger(profileId),
        ensureRewardUnlock(profileId),
      ]);

      return agent;
    }),
  );

  return seededAgents;
}

async function buildSimulationBalances(profileId: string) {
  const profile = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    profileId,
  );
  if (!profile) {
    return [] as SimulationBalance[];
  }

  const worlds = await ensureTokenWorlds();
  const rewardLedger = await ensureRewardLedger(profileId);

  return Promise.all(
    worlds.map(async (world) => {
      const baselineHoldings = world.totalSupply * 0.1;
      let actualHoldings = 0;
      let actualHoldingsSource: SimulationBalance["actualHoldingsSource"] = "not_configured";

      if (world.contractAddress) {
        if (world.chain === "solana" && profile.chain === "solana") {
          const balance = await getSolanaTokenBalance(profile.ownerWallet, world.contractAddress);
          actualHoldings = Math.max(0, balance ?? 0);
          actualHoldingsSource = balance == null ? "lookup_failed" : "configured";
        } else if (
          world.chain === "bnb" &&
          (profile.chain === "bnb" || profile.chain === "ethereum") &&
          isHexWallet(profile.ownerWallet)
        ) {
          const balance = await getBnbTokenBalance(profile.ownerWallet, world.contractAddress);
          actualHoldings = Math.max(0, balance ?? 0);
          actualHoldingsSource = balance == null ? "lookup_failed" : "configured";
        }
      }

      return {
        actualHoldings,
        actualHoldingsSource,
        baselineHoldings,
        pendingRewards: rewardLedger.pendingRewards,
        simulatedHoldings: baselineHoldings + actualHoldings,
        symbol: world.symbol,
        totalRewards: rewardLedger.totalRewards,
        worldId: world.id,
      } satisfies SimulationBalance;
    }),
  );
}

async function listVerificationEvents(profileId?: string | null) {
  const events = await simList<VerificationEvent>(FIRESTORE_SIM_COLLECTIONS.verificationEvents);
  return events
    .filter((event) => !profileId || event.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function listBotBindings(identityProfileId?: string | null) {
  const bindings = await simList<BotBinding>(FIRESTORE_SIM_COLLECTIONS.botBindings);
  return bindings
    .filter((binding) => !identityProfileId || binding.identityProfileId === identityProfileId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function getAgentByBitClawProfileId(profileId: string) {
  if (!isAgentProfileId(profileId)) {
    return null;
  }

  const profile = await getStoredBitClawProfile(profileId);
  const agentId = profile?.guestId || profileId.replace(/^agent:/, "");
  if (!agentId) {
    return null;
  }

  return simGet<RAAgentIdentity>(FIRESTORE_SIM_COLLECTIONS.raAgents, agentId);
}

async function getAgentProfileState(profileId: string) {
  if (!isAgentProfileId(profileId)) {
    return null;
  }

  await warmHyperliquidAgentAbility().catch(() => null);

  const profile = await getStoredBitClawProfile(profileId);
  const [wallets, tipCommitments, profitShares, predictionCalls, tradeRequests] = await Promise.all([
    listAgentWallets(profileId),
    listAgentTipCommitments(profileId),
    listAgentProfitShares(profileId),
    listAgentPredictionCalls(profileId),
    listAgentTradeRequests(profileId),
  ]);

  return {
    gmgn: getSharedGmgnCapability(),
    hyperliquid: getSharedHyperliquidCapability(),
    pasteTrade: getPasteTradeIntegration(profile),
    predictionCalls: predictionCalls.slice(0, 8),
    profitShares: profitShares.slice(0, 12),
    tradeRequests: tradeRequests.slice(0, 12),
    tipCommitments: tipCommitments.slice(0, 12),
    wallets,
  };
}

async function distributeAgentProfitShares(args: {
  profileId: string;
  questionOrMarketId: string;
  realizedProfit: number;
  source: AgentPredictionCall["source"];
  sourcePositionId: string;
}) {
  if (!isAgentProfileId(args.profileId) || args.realizedProfit <= 0) {
    return [];
  }

  const activeCommitments = (await listAgentTipCommitments(args.profileId)).filter(
    (commitment) => commitment.status === "active" && commitment.committedAmount > 0,
  );
  if (!activeCommitments.length) {
    return [];
  }

  const totalCommitted = activeCommitments.reduce(
    (sum, commitment) => sum + commitment.committedAmount,
    0,
  );
  if (totalCommitted <= 0) {
    return [];
  }

  const profitSharePool = Number((args.realizedProfit * 0.5).toFixed(2));
  const createdAt = nowIso();

  return Promise.all(
    activeCommitments.map(async (commitment) => {
      const tipperShare = Number(
        ((profitSharePool * commitment.committedAmount) / totalCommitted).toFixed(2),
      );

      await simUpsert(FIRESTORE_SIM_COLLECTIONS.agentTipCommitments, {
        ...commitment,
        returnedProfit: Number((commitment.returnedProfit + tipperShare).toFixed(2)),
        updatedAt: createdAt,
      } satisfies AgentTipCommitment);

      return simUpsert(FIRESTORE_SIM_COLLECTIONS.agentProfitShares, {
        agentId: commitment.agentId,
        createdAt,
        id: `agent-profit-share:${randomUUID()}`,
        profileId: commitment.profileId,
        questionOrMarketId: args.questionOrMarketId,
        realizedProfit: Number(args.realizedProfit.toFixed(2)),
        source: args.source,
        sourcePositionId: args.sourcePositionId,
        tipCommitmentId: commitment.id,
        tipperShare,
      } satisfies AgentProfitShareRecord);
    }),
  );
}

export async function createAgentTipCommitment(args: {
  amount: number;
  fundingChain: AgentTipCommitment["fundingChain"];
  fundingSymbol: string;
  profileId: string;
  tipperProfileId: string;
}) {
  const [agent, tipperIdentity] = await Promise.all([
    getAgentByBitClawProfileId(args.profileId),
    getLoadedIdentityByProfileId(args.tipperProfileId),
  ]);
  if (!agent) {
    throw new Error("Tips are only available on autonomous agent profiles.");
  }
  if (!tipperIdentity) {
    throw new Error("Load a profile before sponsoring an agent.");
  }

  const commitment = await simUpsert(FIRESTORE_SIM_COLLECTIONS.agentTipCommitments, {
    agentId: agent.id,
    committedAmount: Math.max(1, Number(args.amount.toFixed(2))),
    createdAt: nowIso(),
    fundingChain: args.fundingChain,
    fundingSymbol: args.fundingSymbol,
    id: `agent-tip:${randomUUID()}`,
    profileId: args.profileId,
    profitShareBps: 5_000,
    returnedProfit: 0,
    status: "active",
    tipperProfileId: tipperIdentity.profile.id,
    tipperWallet: tipperIdentity.profile.ownerWallet,
    updatedAt: nowIso(),
  } satisfies AgentTipCommitment);

  await creditRewards(tipperIdentity.profile.id, Math.max(1, commitment.committedAmount * 0.02), {
    badge: "Agent sponsor",
    reason: "agent-tip-commitment",
  });

  return commitment;
}

function normalizeWorldShares(worlds: TokenWorld[], rawScores: Map<string, number>) {
  const total = worlds.reduce((sum, world) => sum + Math.max(0, rawScores.get(world.id) ?? 0), 0);

  if (!worlds.length) {
    return new Map<string, number>();
  }

  if (total <= 0) {
    const equalShare = 1 / worlds.length;
    return new Map(worlds.map((world) => [world.id, equalShare]));
  }

  return new Map(
    worlds.map((world) => [
      world.id,
      Math.max(0, rawScores.get(world.id) ?? 0) / total,
    ]),
  );
}

async function writeBadgeEvents(args: {
  badges: string[];
  profileId: string;
  reason: string;
}) {
  if (!args.badges.length) {
    return;
  }

  await Promise.all(
    args.badges.map((badge) =>
      simUpsert(FIRESTORE_SIM_COLLECTIONS.badgeEvents, {
        badge,
        category: categorizeBadge(badge),
        createdAt: nowIso(),
        id: `badge:${args.profileId}:${sha256Hex(`${badge}:${args.reason}:${nowIso()}`)}`,
        profileId: args.profileId,
        reason: args.reason,
      } satisfies BadgeEvent),
    ),
  );
}

async function syncRankState(args: {
  claimsUnlocked: boolean;
  profileId: string;
  totalRewards: number;
}) {
  const label = deriveRankLabel(args);
  const rank = deriveRankNumber(args);
  const existing = await simGet<RankStateRecord>(
    FIRESTORE_SIM_COLLECTIONS.rankState,
    args.profileId,
  );

  const record = await simUpsert(FIRESTORE_SIM_COLLECTIONS.rankState, {
    createdAt: existing?.createdAt || nowIso(),
    id: args.profileId,
    label,
    profileId: args.profileId,
    rank,
    totalRewards: args.totalRewards,
    updatedAt: nowIso(),
  } satisfies RankStateRecord);

  return record;
}

async function writeRewardGrantEvent(args: {
  effectiveReward: number;
  percolatorH: number;
  plannedReward: number;
  profileId: string;
  reason: string;
}) {
  return simUpsert(FIRESTORE_SIM_COLLECTIONS.rewardGrants, {
    createdAt: nowIso(),
    effectiveReward: args.effectiveReward,
    id: `reward:${randomUUID()}`,
    percolatorH: args.percolatorH,
    plannedReward: args.plannedReward,
    profileId: args.profileId,
    reason: args.reason,
  } satisfies RewardGrantEvent);
}

async function writeVerificationEvent(args: {
  chain: "solana" | "bnb" | "support";
  profileId: string;
  reason: RewardUnlockReason;
  requiredTokenAmount?: string | null;
  tokenAddress?: string | null;
  transactionId?: string | null;
  verificationTarget?: string | null;
  verifiedWallet?: string | null;
  worldId?: string | null;
}) {
  return simUpsert(FIRESTORE_SIM_COLLECTIONS.verificationEvents, {
    chain: args.chain,
    createdAt: nowIso(),
    id: `verification:${randomUUID()}`,
    profileId: args.profileId,
    reason: args.reason,
    requiredTokenAmount: args.requiredTokenAmount ?? null,
    tokenAddress: args.tokenAddress ?? null,
    transactionId: args.transactionId ?? null,
    verificationTarget: args.verificationTarget ?? null,
    verifiedWallet: args.verifiedWallet ?? null,
    worldId: args.worldId ?? null,
  } satisfies VerificationEvent);
}

export async function getPercolatorState(): Promise<PercolatorState> {
  const [predictionPositions, perpPositions, rewardLedgers] = await Promise.all([
    simList<PredictionPosition>(FIRESTORE_SIM_COLLECTIONS.tianziPositions),
    simList<SimPerpPosition>(FIRESTORE_SIM_COLLECTIONS.nezhaPositions),
    simList<RewardLedger>(FIRESTORE_SIM_COLLECTIONS.rewardLedgers),
  ]);

  const predictionBudget = predictionPositions.reduce(
    (sum, position) => sum + (position.settledAt ? 0 : position.stake),
    0,
  );
  const perpBudget = perpPositions.reduce(
    (sum, position) => sum + Math.abs(position.quantity * position.markPrice) * 0.02,
    0,
  );
  const lockedRewardPressure = rewardLedgers.reduce(
    (sum, ledger) => sum + ledger.lockedRewards,
    0,
  );
  const requestedCompetitiveBudget =
    predictionBudget + perpBudget + lockedRewardPressure;
  const safeCompetitiveBudget = PERCOLATOR_SAFE_COMPETITIVE_BUDGET;
  const h =
    requestedCompetitiveBudget <= 0
      ? 1
      : clamp(
          safeCompetitiveBudget / requestedCompetitiveBudget,
          0,
          1,
        );

  return {
    effectiveBenefitMultiplier: h,
    h,
    requestedCompetitiveBudget: Number(
      requestedCompetitiveBudget.toFixed(2),
    ),
    safeCompetitiveBudget,
    updatedAt: nowIso(),
  } satisfies PercolatorState;
}

export async function getHybridFutarchyState(): Promise<HybridFutarchyState> {
  const [worlds, intents, questions, predictionPositions, markets, orders] = await Promise.all([
    ensureTokenWorlds(),
    simList<GenDelveVoteIntent>(FIRESTORE_SIM_COLLECTIONS.genDelveVoteIntents),
    simList<PredictionQuestion>(FIRESTORE_SIM_COLLECTIONS.tianziQuestions),
    simList<PredictionPosition>(FIRESTORE_SIM_COLLECTIONS.tianziPositions),
    ensurePerpMarkets(),
    simList<SimPerpOrder>(FIRESTORE_SIM_COLLECTIONS.nezhaOrders),
  ]);

  const governanceRaw = new Map(worlds.map((world) => [world.id, 0]));
  for (const intent of intents) {
    if (intent.status !== "verified") {
      continue;
    }
    governanceRaw.set(intent.worldId, (governanceRaw.get(intent.worldId) ?? 0) + 1);
  }

  const questionById = new Map(questions.map((question) => [question.id, question]));
  const futarchyRaw = new Map(worlds.map((world) => [world.id, 0]));
  for (const position of predictionPositions) {
    const question = questionById.get(position.questionId);
    if (!question?.worldIds.length) {
      continue;
    }

    const apportionedStake = position.stake / question.worldIds.length;
    for (const worldId of question.worldIds) {
      futarchyRaw.set(worldId, (futarchyRaw.get(worldId) ?? 0) + apportionedStake);
    }
  }

  const marketById = new Map(markets.map((market) => [market.id, market]));
  const revenueRaw = new Map(worlds.map((world) => [world.id, 0]));
  for (const order of orders) {
    if (order.status !== "filled") {
      continue;
    }

    const market = marketById.get(order.marketId);
    if (!market) {
      continue;
    }

    const fillReferencePrice =
      order.limitPrice ?? market.markPrice ?? market.referencePrice ?? 0;
    const notional = Math.abs(order.quantity * fillReferencePrice);
    revenueRaw.set(market.worldId, (revenueRaw.get(market.worldId) ?? 0) + notional);
  }

  const governanceShares = normalizeWorldShares(worlds, governanceRaw);
  const futarchyShares = normalizeWorldShares(worlds, futarchyRaw);
  const revenueShares = normalizeWorldShares(worlds, revenueRaw);
  const scoredWorlds = worlds.map((world) => {
    const governanceShare = governanceShares.get(world.id) ?? 0;
    const futarchyShare = futarchyShares.get(world.id) ?? 0;
    const revenueShare = revenueShares.get(world.id) ?? 0;
    const finalScore =
      governanceShare * HYBRID_FUTARCHY_WEIGHTS.governance +
      futarchyShare * HYBRID_FUTARCHY_WEIGHTS.futarchy +
      revenueShare * HYBRID_FUTARCHY_WEIGHTS.revenue;

    return {
      displayName: world.displayName,
      finalScore: Number(finalScore.toFixed(4)),
      futarchyShare: Number(futarchyShare.toFixed(4)),
      governanceShare: Number(governanceShare.toFixed(4)),
      revenueShare: Number(revenueShare.toFixed(4)),
      worldId: world.id,
    };
  });

  const rankedWorlds = scoredWorlds
    .slice()
    .sort((left, right) => right.finalScore - left.finalScore);
  const leaderWorld = rankedWorlds[0];

  return {
    leaderWorldId: leaderWorld?.worldId ?? null,
    updatedAt: nowIso(),
    weights: { ...HYBRID_FUTARCHY_WEIGHTS },
    worlds: rankedWorlds,
  } satisfies HybridFutarchyState;
}

async function creditRewards(
  profileId: string,
  delta: number,
  options?: RewardDeltaOptions,
) {
  const rewardLedger = await ensureRewardLedger(profileId);
  const rewardUnlock = await ensureRewardUnlock(profileId);
  const percolator = await getPercolatorState();
  const plannedReward = Math.max(0, Number(delta.toFixed(2)));
  const roundedDelta = Math.max(
    0,
    Number((plannedReward * percolator.effectiveBenefitMultiplier).toFixed(2)),
  );
  const lockedRewards = rewardUnlock.claimsUnlocked
    ? rewardLedger.lockedRewards
    : rewardLedger.lockedRewards + roundedDelta;
  const availableRewards = rewardUnlock.claimsUnlocked
    ? rewardLedger.availableRewards + roundedDelta
    : rewardLedger.availableRewards;
  const previousBadges = rewardLedger.badges;
  const badges = options?.badge
    ? [...new Set([...previousBadges, options.badge])]
    : previousBadges;
  const nextTotalRewards = rewardLedger.totalRewards + roundedDelta;
  const nextRank = deriveRankNumber({
    claimsUnlocked: rewardUnlock.claimsUnlocked,
    totalRewards: nextTotalRewards,
  });

  const nextLedger = await simUpsert(FIRESTORE_SIM_COLLECTIONS.rewardLedgers, {
    ...rewardLedger,
    availableRewards,
    badges,
    lockedRewards,
    pendingRewards: lockedRewards,
    rank: nextRank,
    totalRewards: nextTotalRewards,
    updatedAt: nowIso(),
  } satisfies RewardLedger);

  await writeRewardGrantEvent({
    effectiveReward: roundedDelta,
    percolatorH: percolator.h,
    plannedReward,
    profileId,
    reason: options?.reason || "reward-grant",
  });

  const newBadges = badges.filter((badge) => !previousBadges.includes(badge));
  await writeBadgeEvents({
    badges: newBadges,
    profileId,
    reason: options?.reason || "reward-grant",
  });
  await syncRankState({
    claimsUnlocked: rewardUnlock.claimsUnlocked,
    profileId,
    totalRewards: nextTotalRewards,
  });

  return nextLedger;
}

async function unlockRewards(profileId: string, reason: RewardUnlockReason) {
  const rewardLedger = await ensureRewardLedger(profileId);
  const rewardUnlock = await ensureRewardUnlock(profileId);
  const timestamp = nowIso();

  const nextUnlock = await simUpsert(FIRESTORE_SIM_COLLECTIONS.rewardUnlocks, {
    ...rewardUnlock,
    claimsUnlocked: true,
    id: rewardUnlock.id,
    lastVerifiedActionAt: timestamp,
    reason,
    updatedAt: timestamp,
    verifiedActionCount: rewardUnlock.verifiedActionCount + 1,
  } satisfies RewardUnlockState);

  const nextLedger = await simUpsert(FIRESTORE_SIM_COLLECTIONS.rewardLedgers, {
    ...rewardLedger,
    availableRewards: rewardLedger.availableRewards + rewardLedger.lockedRewards,
    badges: [...new Set([...rewardLedger.badges, "Verified owner"])],
    lockedRewards: 0,
    pendingRewards: 0,
    rank: deriveRankNumber({
      claimsUnlocked: true,
      totalRewards: rewardLedger.totalRewards,
    }),
    updatedAt: timestamp,
  } satisfies RewardLedger);

  await writeBadgeEvents({
    badges: nextLedger.badges.filter((badge) => !rewardLedger.badges.includes(badge)),
    profileId,
    reason,
  });
  await syncRankState({
    claimsUnlocked: true,
    profileId,
    totalRewards: nextLedger.totalRewards,
  });

  const identityProfile = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    profileId,
  );
  if (identityProfile) {
    await syncHumanBitClawProfile(identityProfile);
  }

  return nextUnlock;
}

export async function getLoadedIdentityByProfileId(profileId: string) {
  const profile = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    profileId,
  );
  if (!profile) {
    return null;
  }

  const [aliases, rewardLedger, rewardUnlock, balances, benchmarks, botBindings, verificationEvents, worlds] =
    await Promise.all([
    simFilter<IdentityAlias>(
      FIRESTORE_SIM_COLLECTIONS.identityAliases,
      (alias) => alias.profileId === profile.id,
    ),
    ensureRewardLedger(profile.id),
    ensureRewardUnlock(profile.id),
    buildSimulationBalances(profile.id),
    getBenchmarkQuotes(),
    listBotBindings(profile.id),
    listVerificationEvents(profile.id),
    ensureTokenWorlds(),
  ]);

  return {
    aliases,
    balances,
    benchmarks,
    botBindings,
    loadedAt: nowIso(),
    profile,
    rewardLedger,
    rewardUnlock,
    verification: getRewardUnlockVerificationState({
      balances,
      profileId: profile.id,
      rewardUnlock,
      verificationEvents,
      worlds,
    }),
    wallDisclaimer: {
      lines: [...PROFILE_WALL_DISCLAIMER.lines],
      title: PROFILE_WALL_DISCLAIMER.title,
    },
  } satisfies LoadedIdentity;
}

function normalizeHolderAgentDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 48);
}

export async function createHolderDeployedAgent(args: {
  displayName: string;
  profileId: string;
  strategySummary?: string | null;
}) {
  await warmHyperliquidAgentAbility().catch(() => null);
  const gmgn = getSharedGmgnCapability();
  const hyperliquid = getSharedHyperliquidCapability();
  const loadedIdentity = await getLoadedIdentityByProfileId(args.profileId);
  if (!loadedIdentity) {
    throw new Error("Load a verified profile before deploying an agent.");
  }

  if (!loadedIdentity.verification.canDeployAgent) {
    throw new Error(
      "Only verified $CAMIUP holders on Solana or BNB can deploy a personal agent cockpit.",
    );
  }

  const displayName = normalizeHolderAgentDisplayName(args.displayName);
  if (!displayName) {
    throw new Error("Agent deployments need a display name.");
  }

  const createdAt = nowIso();
  const agentId = `holder-agent:${loadedIdentity.profile.id}:${randomUUID()}`;
  const reportPriceUsdc = Number(getServerEnv().TIANSHI_REPORT_PRICE_USDC);
  const reportBuyWindowSeconds = Number(getServerEnv().TIANSHI_REPORT_BUY_WINDOW_SECONDS);
  const reportTradeDelaySeconds = Number(getServerEnv().TIANSHI_REPORT_TRADE_DELAY_SECONDS);
  const strategySummary =
    args.strategySummary?.trim() ||
    `${displayName} trades Pump.fun and Four.meme launch tokens, inherits Hyperliquid perp market access through Tianshi's shared agent wallet, keeps prediction-market context on Polygon, and stays subordinate to the locked Tianshi risk plane.`;

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.userDeployedAgents, {
    agfundMarketplaceUrl: getServerEnv().TIANSHI_AGFUND_MARKETPLACE_URL,
    createdAt,
    displayName,
    gmgnApiHost: gmgn.apiHost,
    gmgnCriticalAuthReady: gmgn.criticalAuthReady,
    gmgnQueryChains: [...gmgn.queryChains],
    gmgnSharedKeyEnabled: gmgn.sharedKeyEnabled,
    gmgnToolFamilies: [...gmgn.toolFamilies],
    hyperliquidApiUrl: hyperliquid.apiUrl,
    hyperliquidApiWallet: hyperliquid.apiWalletAddress,
    hyperliquidApiWalletApproved: hyperliquid.apiWalletApproved,
    hyperliquidInfoReady: hyperliquid.infoReady,
    hyperliquidLivePerpsEnabled: hyperliquid.livePerpsEnabled,
    hyperliquidMasterWallet: hyperliquid.masterWalletAddress,
    hyperliquidWsUrl: hyperliquid.wsUrl,
    id: agentId,
    ownerProfileId: loadedIdentity.profile.id,
    ownerWallet: loadedIdentity.profile.ownerWallet,
    perpVenue: "hyperliquid",
    predictionNetwork: "polygon",
    reportBuyWindowSeconds,
    reportPriceUsdc,
    reportTradeDelaySeconds,
    sellKnowledgeBaseEnabled: getServerEnv().TIANSHI_KNOWLEDGE_SALES_ENABLED === "true",
    status: "active",
    strategySummary,
    tradeGoal: "Maximize risk-adjusted profits inside the locked Tianshi control plane.",
    tradingVenues: ["pump.fun", "four.meme"],
    updatedAt: createdAt,
    verificationTick: loadedIdentity.verification.verificationTick,
    wallets: buildHolderDeployedAgentWalletRecords({
      agentId,
      profileId: loadedIdentity.profile.id,
    }),
  } satisfies HolderDeployedAgent);
}

export async function getHolderAgentCockpitState(profileId?: string | null) {
  await warmHyperliquidAgentAbility().catch(() => null);
  const loadedIdentity = profileId
    ? await getLoadedIdentityByProfileId(profileId)
    : await getCurrentLoadedIdentity();
  const deployments = loadedIdentity
    ? await listHolderDeployedAgents(loadedIdentity.profile.id)
    : [];

  return {
    agfundMarketplaceUrl: getServerEnv().TIANSHI_AGFUND_MARKETPLACE_URL,
    deployments,
    eligibility: loadedIdentity?.verification ?? null,
    gmgn: getSharedGmgnCapability(),
    hyperliquid: getSharedHyperliquidCapability(),
    loadedIdentity,
    reportCommerce: {
      enabled: getServerEnv().TIANSHI_REPORT_COMMERCE_ENABLED === "true",
      knowledgeSalesEnabled: getServerEnv().TIANSHI_KNOWLEDGE_SALES_ENABLED === "true",
      postPurchaseTradeDelaySeconds: Number(getServerEnv().TIANSHI_REPORT_TRADE_DELAY_SECONDS),
      priceUsdc: Number(getServerEnv().TIANSHI_REPORT_PRICE_USDC),
      purchaseWindowSeconds: Number(getServerEnv().TIANSHI_REPORT_BUY_WINDOW_SECONDS),
    },
  };
}

export async function upsertBotBindingForCurrentLoadedIdentity(args: {
  displayName?: string | null;
  externalUserId: string;
  platform: BotBinding["platform"];
}) {
  const loadedIdentity = await getCurrentLoadedIdentity();
  const loadedSession = await getLoadedIdentityCookie();

  if (!loadedIdentity || !loadedSession) {
    throw new Error("Load a Tianezha profile before binding a bot.");
  }

  const externalUserId = args.externalUserId.trim();
  if (!externalUserId) {
    throw new Error("External user id is required.");
  }

  const displayName = args.displayName?.trim() || null;
  const existing = await simFindOne<BotBinding>(
    FIRESTORE_SIM_COLLECTIONS.botBindings,
    (binding) =>
      binding.identityProfileId === loadedIdentity.profile.id &&
      binding.platform === args.platform &&
      binding.externalUserId === externalUserId,
  );
  const timestamp = nowIso();

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.botBindings, {
    createdAt: existing?.createdAt || timestamp,
    displayName,
    externalUserId,
    id:
      existing?.id ||
      `bot:${loadedIdentity.profile.id}:${args.platform}:${sha256Hex(externalUserId).slice(0, 12)}`,
    identityProfileId: loadedIdentity.profile.id,
    loadedSessionId: loadedSession.id,
    platform: args.platform,
    status: "bound",
    updatedAt: timestamp,
  } satisfies BotBinding);
}

export async function getCurrentLoadedIdentity() {
  const cookie = await getLoadedIdentityCookie();
  if (!cookie) {
    return null;
  }

  return getLoadedIdentityByProfileId(cookie.profileId);
}

export async function loadOrCreateIdentity(input: string) {
  const parsed = normalizeAddressInput(input);
  const profileId = buildIdentityProfileId(parsed.chain, parsed.normalizedAddress);
  const existing = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    profileId,
  );

  const profile =
    existing ||
    (await simUpsert(FIRESTORE_SIM_COLLECTIONS.identityProfiles, {
      avatarSeed: parsed.normalizedAddress,
      badges: [],
      bio: `Simulation-first profile reconstructed from ${parsed.displayLabel}.`,
      bitClawProfileId: profileId,
      chain: parsed.chain,
      createdAt: nowIso(),
      displayName:
        parsed.sourceKind === "address"
          ? shortenAddress(parsed.walletAddress)
          : parsed.displayLabel,
      id: profileId,
      nameService: parsed.sourceKind,
      normalizedAddress: parsed.normalizedAddress,
      ownerWallet: parsed.walletAddress,
      publicLabel: parsed.displayLabel,
      rank: 1,
      simulationHandle: getSimulationHandle(parsed.displayLabel),
      sourceKind: parsed.sourceKind,
      updatedAt: nowIso(),
      walletAddress: parsed.walletAddress,
    } satisfies IdentityProfile));

  if (parsed.sourceKind !== "address") {
    await simUpsert(FIRESTORE_SIM_COLLECTIONS.identityAliases, {
      alias: parsed.displayLabel,
      chain: parsed.chain,
      createdAt: nowIso(),
      id: `alias:${parsed.displayLabel.toLowerCase()}`,
      profileId: profile.id,
      reservedToWallet: parsed.walletAddress,
      sourceKind: parsed.sourceKind,
      updatedAt: nowIso(),
    } satisfies IdentityAlias);
  }

  await Promise.all([
    ensureRewardLedger(profile.id),
    ensureRewardUnlock(profile.id),
    syncHumanBitClawProfile(profile),
  ]);

  const cookie = await setLoadedIdentityCookie(profile.id);
  await simUpsert(FIRESTORE_SIM_COLLECTIONS.loadedIdentitySessions, {
    id: cookie.id,
    loadedAt: cookie.issuedAt,
    profileId: profile.id,
    sourceInput: input.trim(),
  } satisfies LoadedIdentitySessionRecord);

  return getLoadedIdentityByProfileId(profile.id);
}

async function getIdentityOrBitClawProfile(profileId: string) {
  const identity = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    profileId,
  );
  if (identity) {
    await syncHumanBitClawProfile(identity);
    return getStoredBitClawProfile(identity.bitClawProfileId);
  }

  return getStoredBitClawProfile(profileId);
}

export async function createBitClawWallPost(profileId: string, body: string) {
  const profile = await getIdentityOrBitClawProfile(profileId);
  if (!profile) {
    throw new Error("Profile wall not found");
  }

  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Wall posts need text");
  }

  const timestamp = nowIso();
  const record = {
    authorType: profile.authorType,
    body: trimmed,
    createdAt: timestamp,
    id: `wall:${profile.id}:${randomUUID()}`,
    profileId: profile.id,
    updatedAt: timestamp,
  } satisfies BitClawPostRecord;

  await upsertBitClawPost(record);
  if (profile.authorType === "human") {
    await creditRewards(profile.id, 8, {
      badge: "Public poster",
      reason: "bitclaw-post",
    });
  }

  return record;
}

export async function createAgentTradeRequest(args: {
  body: string;
  kind: AgentTradeRequestKind;
  profileId: string;
  requesterProfileId?: string | null;
  sourceUrl?: string | null;
  title: string;
}) {
  if (!isAgentProfileId(args.profileId)) {
    throw new Error("Trade requests can only be attached to autonomous agent walls.");
  }

  const profile = await getStoredBitClawProfile(args.profileId);
  if (!profile?.isAutonomous) {
    throw new Error("Trade requests can only target autonomous agent profiles.");
  }

  const title = normalizeTradeRequestTitle(args.title);
  const body = normalizeTradeRequestBody(args.body);
  if (!title || !body) {
    throw new Error("Trade requests need both a title and a thesis.");
  }

  const sourceUrl = normalizeOptionalSourceUrl(args.sourceUrl);
  const kind = args.kind === "prediction-market" ? "prediction-market" : "paste-trade";
  const createdAt = nowIso();

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.agentTradeRequests, {
    body,
    createdAt,
    id: `agent-request:${args.profileId}:${randomUUID()}`,
    kind,
    marketScope: kind === "prediction-market" ? "polygon-prediction" : "mixed",
    profileId: args.profileId,
    requesterProfileId: args.requesterProfileId ?? null,
    sourceUrl,
    status: "open",
    title,
    updatedAt: createdAt,
  } satisfies AgentTradeRequest);
}

export async function getAgentTradeRequestState(profileId: string) {
  if (!isAgentProfileId(profileId)) {
    return null;
  }

  const profile = await getStoredBitClawProfile(profileId);
  if (!profile?.isAutonomous) {
    return null;
  }

  return {
    pasteTrade: getPasteTradeIntegration(profile),
    profile,
    requests: await listAgentTradeRequests(profile.id),
  };
}

export async function getBitClawWall(profileId: string): Promise<BitClawWallState | null> {
  const [profile, posts, rewardLedger, rewardUnlock, agentState, verificationEvents, worlds, balances] = await Promise.all([
    getIdentityOrBitClawProfile(profileId),
    getBitClawFeed(120),
    simGet<RewardLedger>(FIRESTORE_SIM_COLLECTIONS.rewardLedgers, profileId),
    simGet<RewardUnlockState>(FIRESTORE_SIM_COLLECTIONS.rewardUnlocks, profileId),
    getAgentProfileState(profileId),
    listVerificationEvents(profileId),
    ensureTokenWorlds(),
    buildSimulationBalances(profileId),
  ]);

  if (!profile) {
    return null;
  }

  return {
    agentState,
    disclaimer: {
      lines: [...PROFILE_WALL_DISCLAIMER.lines],
      title: PROFILE_WALL_DISCLAIMER.title,
    },
    posts: posts.filter((post) => post.profileId === profile.id),
    profile,
    rewardLedger,
    rewardUnlock,
    verification: rewardUnlock
      ? getRewardUnlockVerificationState({
          balances,
          profileId: profile.id,
          rewardUnlock,
          verificationEvents,
          worlds,
        })
      : null,
    wallProfileId: profile.id,
  };
}

export async function getBitClawMainState(): Promise<BitClawMainState> {
  await warmHyperliquidAgentAbility().catch(() => null);
  const [feed, profiles, loadedIdentity, recentRequests] = await Promise.all([
    getBitClawFeed(60),
    listDecoratedBitClawProfiles(),
    getCurrentLoadedIdentity(),
    listAgentTradeRequests(),
  ]);

  return {
    feed,
    hyperliquid: getSharedHyperliquidCapability(),
    loadedIdentity,
    pasteTrade: getPasteTradeIntegration(null),
    profiles: profiles.slice(0, 18),
    recentRequests: recentRequests.slice(0, 8),
  };
}

function getMinuteBucket(date = new Date()) {
  return Math.floor(date.getTime() / 60_000);
}

function getPredictionBucket(date = new Date()) {
  return Math.floor(date.getTime() / (PREDICTION_WINDOW_MINUTES * 60_000));
}

function scoreEntity(seed: string, bucket: number) {
  return seededNumber(seed, bucket % 1_000_000);
}

function toIsoMinute(bucket: number) {
  return new Date(bucket * 60_000).toISOString();
}

async function listWorldQuotes() {
  const worlds = await ensureTokenWorlds();
  return Promise.all(
    worlds.map(async (world) => ({
      priceUsd: (await getTokenWorldQuote(world)).priceUsd,
      world,
    })),
  );
}

async function syncPolymarketMarketSnapshots(limit = 8) {
  try {
    const snapshots = await fetchPolymarketMarkets(limit);
    return Promise.all(
      snapshots.map((snapshot) =>
        simUpsert(FIRESTORE_SIM_COLLECTIONS.polymarketMarketSnapshots, snapshot),
      ),
    );
  } catch {
    const existing = await simList<PolymarketMarketSnapshot>(
      FIRESTORE_SIM_COLLECTIONS.polymarketMarketSnapshots,
    );
    return existing
      .slice()
      .sort((left, right) => right.volume - left.volume)
      .slice(0, limit);
  }
}

async function writeMerkleSnapshot(
  kind: MerkleSnapshotRecord["kind"],
  checkpointAt: string,
  entityIds: string[],
) {
  const id = `${kind}:${checkpointAt}`;
  const existing = await simGet<MerkleSnapshotRecord>(
    FIRESTORE_SIM_COLLECTIONS.merkleSnapshots,
    id,
  );
  if (existing) {
    return existing;
  }

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.merkleSnapshots, {
    ...buildMerkleSnapshot({
      checkpointAt,
      entityIds,
      kind,
    }),
    id,
  });
}

async function buildHeartbeatPost(agent: RAAgentIdentity, mask: ProfileMask, minuteBucket: number) {
  const quotes = await listWorldQuotes();
  const question = await ensureActivePredictionQuestion();
  const solWorld = quotes.find((entry) => entry.world.id === "camiup-sol");
  const bnbWorld = quotes.find((entry) => entry.world.id === "camiup-bnb");
  const sentencePool = [
    `${mask.label} mask on deck. SOL world ${solWorld ? `$${solWorld.priceUsd.toFixed(4)}` : "warming"}, BNB world ${bnbWorld ? `$${bnbWorld.priceUsd.toFixed(4)}` : "warming"}.`,
    `${agent.canonicalName} rotating through ${mask.label}. Open question: ${question.title}`,
    `${mask.label} readout: simulation only, public wall, rewards flow to the canonical wallet behind the profile.`,
  ];

  return sentencePool[minuteBucket % sentencePool.length];
}

async function seedAgentPredictionCalls(snapshot: Heartbeat42Snapshot) {
  const [question, book, polymarketMarkets] = await Promise.all([
    ensureActivePredictionQuestion(new Date(snapshot.tickStartAt)),
    getTianziState(),
    syncPolymarketMarketSnapshots(6),
  ]);
  if (!isPredictionQuestionStillOpen(question)) {
    return;
  }
  const activeAgents = snapshot.activeAgentIds.slice(0, 4);
  const topPolymarketMarkets = polymarketMarkets.slice(0, 2);

  await Promise.all(
    activeAgents.map(async (agentId, index) => {
      const agent = await simGet<RAAgentIdentity>(FIRESTORE_SIM_COLLECTIONS.raAgents, agentId);
      if (!agent) {
        return;
      }

      const profileId = buildAgentProfileId(agent.id);
      const signalScore = scoreEntity(agent.id, snapshot.tickMinute);
      const selection = signalScore >= 0.5 ? "yes" : "no";
      const conviction = convictionFromScore(signalScore);
      const callId = `agent-call:tianzi:${question.id}:${agent.id}`;
      const existingCall = await simGet<AgentPredictionCall>(
        FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls,
        callId,
      );

      if (!existingCall && index < 2) {
        const call = await simUpsert(FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls, {
          agentId: agent.id,
          askHumansToParticipate: true,
          conviction,
          createdAt: snapshot.tickStartAt,
          expiresAt: question.closesAt,
          id: callId,
          profileId,
          question: question.title,
          rationale: `Heartbeat mask leans ${selection.toUpperCase()} with ${conviction} conviction. Current YES price ${(book.book.yesPrice * 100).toFixed(1)}%.`,
          settlementStatus: "open",
          side: selection,
          source: "tianzi",
          targetId: question.id,
          targetUrl: "/tianzi",
          updatedAt: snapshot.tickStartAt,
        } satisfies AgentPredictionCall);

        const existingPosition = await simFindOne<PredictionPosition>(
          FIRESTORE_SIM_COLLECTIONS.tianziPositions,
          (position) => position.callId === call.id,
        );
        if (!existingPosition) {
          try {
            await placePredictionStake({
              callId: call.id,
              profileId,
              questionId: question.id,
              selection,
              source: "tianzi",
              stake: 25 + Math.round(signalScore * 50),
            });
          } catch (error) {
            if (isPredictionQuestionClosedError(error)) {
              await simDelete(FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls, call.id);
              return;
            }

            throw error;
          }
        }

        await upsertBitClawPost({
          authorType: "agent",
          body: `${agent.canonicalName} calls ${selection.toUpperCase()} on "${question.title}". Public simulation call. Humans can join the Tianzi book before ${new Date(question.closesAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`,
          createdAt: snapshot.tickStartAt,
          id: `agent-call-post:tianzi:${question.id}:${agent.id}`,
          profileId,
          tokenSymbol: "$CAMIUP",
          updatedAt: snapshot.tickStartAt,
        } satisfies BitClawPostRecord);
      }

      const externalMarket = topPolymarketMarkets[index % Math.max(1, topPolymarketMarkets.length)];
      if (!externalMarket) {
        return;
      }

      const externalCallId = `agent-call:polymarket:${externalMarket.id}:${agent.id}`;
      const existingExternalCall = await simGet<AgentPredictionCall>(
        FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls,
        externalCallId,
      );
      if (existingExternalCall) {
        return;
      }

      const side =
        (externalMarket.yesPrice ?? 0.5) >= 0.5
          ? "yes"
          : "no";
      await simUpsert(FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls, {
        agentId: agent.id,
        askHumansToParticipate: true,
        conviction: convictionFromScore(externalMarket.yesPrice ?? 0.5),
        createdAt: snapshot.tickStartAt,
        expiresAt: externalMarket.closeTime || addMinutes(new Date(snapshot.tickStartAt), 60).toISOString(),
        id: externalCallId,
        profileId,
        question: externalMarket.question,
        rationale: `Tracking Polymarket reference market with YES ${(100 * (externalMarket.yesPrice ?? 0.5)).toFixed(1)} and NO ${(100 * (externalMarket.noPrice ?? 0.5)).toFixed(1)}. Live execution stays agent-gated.`,
        settlementStatus: "open",
        side,
        source: "polymarket",
        targetId: externalMarket.id,
        targetUrl: externalMarket.url,
        updatedAt: snapshot.tickStartAt,
      } satisfies AgentPredictionCall);

      await upsertBitClawPost({
        authorType: "agent",
        body: `${agent.canonicalName} is watching Polymarket: "${externalMarket.question}". Side ${side.toUpperCase()}. Humans can inspect ${externalMarket.url} while the agent keeps the call on its public wall.`,
        createdAt: snapshot.tickStartAt,
        id: `agent-call-post:polymarket:${externalMarket.id}:${agent.id}`,
        profileId,
        updatedAt: snapshot.tickStartAt,
      } satisfies BitClawPostRecord);
    }),
  );
}

async function seedHeartbeatPosts(snapshot: Heartbeat42Snapshot) {
  const masks = await ensureRaMasks();
  const postAgentIds = snapshot.eligiblePostAgentIds.slice(0, 6);

  await Promise.all(
    postAgentIds.map(async (agentId, index) => {
      const agent = await simGet<RAAgentIdentity>(FIRESTORE_SIM_COLLECTIONS.raAgents, agentId);
      if (!agent) {
        return;
      }

      const maskId = snapshot.maskAssignments[agentId];
      const mask = masks.find((entry) => entry.id === maskId) || masks[index % masks.length];
      const profileId = buildAgentProfileId(agent.id);
      const postId = `heartbeat-post:${snapshot.id}:${agent.id}`;
      const existingPosts = await listBitClawPosts(200, { includeHidden: true });
      if (existingPosts.some((post) => post.id === postId)) {
        return;
      }

      await upsertBitClawPost({
        authorType: "agent",
        body: await buildHeartbeatPost(agent, mask, snapshot.tickMinute),
        createdAt: snapshot.tickStartAt,
        id: postId,
        profileId,
        tokenSymbol: "$CAMIUP",
        updatedAt: snapshot.tickStartAt,
      } satisfies BitClawPostRecord);
    }),
  );
}

async function refreshRewardSnapshots(snapshot: Heartbeat42Snapshot) {
  const checkpointAt = snapshot.tickStartAt;
  const rewardLedgers = await simList<RewardLedger>(FIRESTORE_SIM_COLLECTIONS.rewardLedgers);
  const rewardIds = rewardLedgers.map((record) => record.profileId);
  await writeMerkleSnapshot("heartbeatActiveSet", checkpointAt, snapshot.activeAgentIds);

  const recentPosts = await listBitClawPosts(50);
  await writeMerkleSnapshot(
    "socialFeedDigest",
    checkpointAt,
    recentPosts.map((post) => post.id),
  );

  if (snapshot.tickMinute % 10 === 0) {
    await writeMerkleSnapshot(
      "maskRotationSet",
      checkpointAt,
      Object.entries(snapshot.maskAssignments).map(([agentId, maskId]) => `${agentId}:${maskId}`),
    );
  }

  if (snapshot.tickMinute % 60 === 0) {
    await writeMerkleSnapshot("rewardSet", checkpointAt, rewardIds);
    await writeMerkleSnapshot(
      "leaderboardCheckpoint",
      checkpointAt,
      rewardLedgers
        .slice()
        .sort((left, right) => right.totalRewards - left.totalRewards)
        .slice(0, 25)
        .map((record) => record.profileId),
    );
  }
}

export async function ensureHeartbeatSnapshot(date = new Date()) {
  await Promise.all([ensureRaAgents(), ensureRaMasks()]);

  const minuteBucket = getMinuteBucket(date);
  const snapshotId = `heartbeat:${minuteBucket}`;
  const existing = await simGet<Heartbeat42Snapshot>(
    FIRESTORE_SIM_COLLECTIONS.heartbeatTicks,
    snapshotId,
  );
  if (existing) {
    await Promise.all([
      seedHeartbeatPosts(existing),
      seedAgentPredictionCalls(existing),
      refreshRewardSnapshots(existing),
    ]);
    return existing;
  }

  const [agents, masks] = await Promise.all([
    simList<RAAgentIdentity>(FIRESTORE_SIM_COLLECTIONS.raAgents),
    simList<ProfileMask>(FIRESTORE_SIM_COLLECTIONS.raProfileMasks),
  ]);

  const activeAgents = agents
    .slice()
    .sort((left, right) => scoreEntity(right.id, minuteBucket) - scoreEntity(left.id, minuteBucket))
    .slice(0, ACTIVE_HEARTBEAT_AGENT_LIMIT);
  const rotationBucket = Math.floor(minuteBucket / 10);
  const maskAssignments = Object.fromEntries(
    activeAgents.map((agent) => {
      const index = Math.floor(scoreEntity(agent.id, rotationBucket) * masks.length) % masks.length;
      return [agent.id, masks[index]?.id || masks[0]?.id || "analyst"];
    }),
  );
  const tickStartAt = toIsoMinute(minuteBucket);
  const snapshot = await simUpsert(FIRESTORE_SIM_COLLECTIONS.heartbeatTicks, {
    activeAgentIds: activeAgents.map((agent) => agent.id),
    createdAt: nowIso(),
    eligiblePostAgentIds: activeAgents.map((agent) => agent.id),
    id: snapshotId,
    maskAssignments,
    merkleRoot: createMerkleRoot(
      "heartbeatActiveSet",
      activeAgents.map((agent) => agent.id),
    ),
    tickMinute: minuteBucket,
    tickStartAt,
  } satisfies Heartbeat42Snapshot);

  await Promise.all(
    activeAgents.map((agent) =>
      simUpsert(FIRESTORE_SIM_COLLECTIONS.heartbeatLeases, {
        agentId: agent.id,
        expiresAt: addMinutes(new Date(snapshot.tickStartAt), HEARTBEAT_INTERVAL_MINUTES).toISOString(),
        id: `lease:${snapshot.id}:${agent.id}`,
        leasedAt: snapshot.tickStartAt,
        snapshotId: snapshot.id,
      } satisfies HeartbeatLease),
    ),
  );

  await Promise.all(
    activeAgents.map((agent) =>
      simUpsert(FIRESTORE_SIM_COLLECTIONS.raAgents, {
        ...agent,
        lastActiveAt: snapshot.tickStartAt,
        lastMaskId: snapshot.maskAssignments[agent.id],
        updatedAt: nowIso(),
      }),
    ),
  );

  await seedHeartbeatPosts(snapshot);
  await seedAgentPredictionCalls(snapshot);
  await refreshRewardSnapshots(snapshot);
  return snapshot;
}

export async function getHeartbeatState() {
  await warmHyperliquidAgentAbility().catch(() => null);
  const snapshot = await ensureHeartbeatSnapshot();
  const [agents, masks, profiles, merkleSnapshots, recentFeed, wallets, calls, polymarketMarkets] = await Promise.all([
    simList<RAAgentIdentity>(FIRESTORE_SIM_COLLECTIONS.raAgents),
    simList<ProfileMask>(FIRESTORE_SIM_COLLECTIONS.raProfileMasks),
    listDecoratedBitClawProfiles({ onlyAgents: true }),
    simList<MerkleSnapshotRecord>(FIRESTORE_SIM_COLLECTIONS.merkleSnapshots),
    getBitClawFeed(24),
    simList<AgentWalletRecord>(FIRESTORE_SIM_COLLECTIONS.agentWallets),
    simList<AgentPredictionCall>(FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls),
    syncPolymarketMarketSnapshots(6),
  ]);

  const activeAgentCards = snapshot.activeAgentIds
    .map((agentId) => {
      const agent = agents.find((entry) => entry.id === agentId);
      if (!agent) {
        return null;
      }

      return {
        agent,
        mask: masks.find((entry) => entry.id === snapshot.maskAssignments[agentId]) || null,
        predictionCalls: calls
          .filter((entry) => entry.agentId === agent.id)
          .slice()
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 3),
        profile: profiles.find((entry) => entry.id === buildAgentProfileId(agent.id)) || null,
        wallets: wallets.filter((entry) => entry.agentId === agent.id),
      } satisfies HeartbeatAgentCard;
    })
    .filter(Boolean) as HeartbeatAgentCard[];

  return {
    agents: activeAgentCards,
    hyperliquid: getSharedHyperliquidCapability(),
    merkleSnapshots: merkleSnapshots
      .slice()
      .sort((left, right) => right.checkpointAt.localeCompare(left.checkpointAt))
      .slice(0, 18),
    polymarketMarkets,
    recentFeed,
    snapshot,
  } satisfies HeartbeatState;
}

function getPredictionTemplate(index: number) {
  if (index === 0) {
    return {
      description: "Resolves YES if the SOL world reference price closes above its open after ten minutes.",
      title: "Will SOL-token close higher in 10 minutes?",
      worldIds: ["camiup-sol"],
    };
  }

  if (index === 1) {
    return {
      description: "Resolves YES if the BNB world reference price closes above its open after ten minutes.",
      title: "Will BNB-token close higher in 10 minutes?",
      worldIds: ["camiup-bnb"],
    };
  }

  return {
    description:
      "Resolves YES if the SOL world outperforms the BNB world over the same ten-minute window.",
    title: "Will SOL-token outperform BNB-token over the next 10 minutes?",
    worldIds: ["camiup-sol", "camiup-bnb"],
  };
}

async function resolvePrediction(question: PredictionQuestion) {
  const worldQuotes = await listWorldQuotes();
  const currentPrices = Object.fromEntries(
    worldQuotes.map(({ priceUsd, world }) => [world.id, priceUsd]),
  );
  const templateIndex = question.templateIndex % 3;
  const solReturn =
    (currentPrices["camiup-sol"] - question.startPrices["camiup-sol"]) /
    Math.max(question.startPrices["camiup-sol"], 0.000001);
  const bnbReturn =
    (currentPrices["camiup-bnb"] - question.startPrices["camiup-bnb"]) /
    Math.max(question.startPrices["camiup-bnb"], 0.000001);
  const result =
    templateIndex === 0
      ? solReturn > 0
      : templateIndex === 1
        ? bnbReturn > 0
        : solReturn > bnbReturn;
  const resolutionResult = result ? "yes" : "no";
  const resolvedQuestion = await simUpsert(FIRESTORE_SIM_COLLECTIONS.tianziQuestions, {
    ...question,
    resolution: {
      explanation:
        templateIndex === 2
          ? `SOL return ${solReturn.toFixed(4)} vs BNB return ${bnbReturn.toFixed(4)}.`
          : `Resolved from the reference close against the opening price.`,
      resolvedAt: nowIso(),
      result: resolutionResult,
    },
    status: "resolved",
    updatedAt: nowIso(),
  } satisfies PredictionQuestion);

  const openPositions = await simFilter<PredictionPosition>(
    FIRESTORE_SIM_COLLECTIONS.tianziPositions,
    (position) => position.questionId === question.id && !position.settledAt,
  );

  await Promise.all(
    openPositions.map(async (position) => {
      const won = position.selection === resolutionResult;
      const realizedProfit = won ? position.shares - position.stake : -position.stake;

      await simUpsert(FIRESTORE_SIM_COLLECTIONS.tianziPositions, {
        ...position,
        realizedPnl: Number(realizedProfit.toFixed(2)),
        settledAt: nowIso(),
        updatedAt: nowIso(),
      } satisfies PredictionPosition);

      await distributeAgentProfitShares({
        profileId: position.profileId,
        questionOrMarketId: question.id,
        realizedProfit,
        source: position.source || "tianzi",
        sourcePositionId: position.id,
      });
    }),
  );

  const openCalls = await simFilter<AgentPredictionCall>(
    FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls,
    (call) =>
      call.source === "tianzi" &&
      call.targetId === question.id &&
      call.settlementStatus === "open",
  );

  await Promise.all(
    openCalls.map((call) =>
      simUpsert(FIRESTORE_SIM_COLLECTIONS.agentPredictionCalls, {
        ...call,
        settlementStatus: call.side === resolutionResult ? "won" : "lost",
        updatedAt: nowIso(),
      } satisfies AgentPredictionCall),
    ),
  );

  return resolvedQuestion;
}

async function ensureActivePredictionQuestion(date = new Date()) {
  const questions = await simList<PredictionQuestion>(FIRESTORE_SIM_COLLECTIONS.tianziQuestions);
  const currentTime = date.getTime();

  await Promise.all(
    questions
      .filter(
        (question) =>
          question.status === "open" && new Date(question.closesAt).getTime() <= currentTime,
      )
      .map((question) => resolvePrediction(question)),
  );

  const bucket = getPredictionBucket(date);
  const id = `tianzi:${bucket}`;
  const existing = await simGet<PredictionQuestion>(FIRESTORE_SIM_COLLECTIONS.tianziQuestions, id);
  if (existing) {
    return existing;
  }

  const openAt = new Date(bucket * PREDICTION_WINDOW_MINUTES * 60_000);
  const quotes = await listWorldQuotes();
  const template = getPredictionTemplate(bucket % 3);
  const startPrices = Object.fromEntries(
    quotes.map(({ priceUsd, world }) => [world.id, priceUsd]),
  );

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.tianziQuestions, {
    closesAt: addMinutes(openAt, PREDICTION_WINDOW_MINUTES).toISOString(),
    createdAt: nowIso(),
    description: template.description,
    id,
    opensAt: openAt.toISOString(),
    startPrices,
    status: "open",
    templateIndex: bucket % 3,
    title: template.title,
    updatedAt: nowIso(),
    worldIds: template.worldIds,
  } satisfies PredictionQuestion);
}

function isPredictionQuestionStillOpen(question: PredictionQuestion, date = new Date()) {
  return (
    question.status === "open" &&
    new Date(question.closesAt).getTime() > date.getTime()
  );
}

function isPredictionQuestionClosedError(error: unknown) {
  return error instanceof Error && error.message === "That Tianzi question is no longer open";
}

function buildPredictionBook(question: PredictionQuestion, worldQuotes: Array<{ priceUsd: number; world: TokenWorld }>) {
  const solCurrent = worldQuotes.find((entry) => entry.world.id === "camiup-sol")?.priceUsd || 0;
  const bnbCurrent = worldQuotes.find((entry) => entry.world.id === "camiup-bnb")?.priceUsd || 0;
  const solStart = question.startPrices["camiup-sol"] || solCurrent || 1;
  const bnbStart = question.startPrices["camiup-bnb"] || bnbCurrent || 1;
  const solReturn = (solCurrent - solStart) / Math.max(solStart, 0.000001);
  const bnbReturn = (bnbCurrent - bnbStart) / Math.max(bnbStart, 0.000001);
  const edge =
    question.templateIndex % 3 === 0
      ? solReturn
      : question.templateIndex % 3 === 1
        ? bnbReturn
        : solReturn - bnbReturn;
  const yesPrice = clamp(0.5 + edge * 8, 0.05, 0.95);
  const totalPositions = 1 + Math.abs(edge) * 200;

  return {
    asOf: nowIso(),
    noLiquidity: 1_500 + totalPositions * 25,
    noPrice: 1 - yesPrice,
    questionId: question.id,
    source: "simulation",
    spreadBps: 250,
    yesLiquidity: 1_500 + totalPositions * 25,
    yesPrice,
  } satisfies PredictionBook;
}

export async function getTianziState(profileId?: string | null) {
  const [question, worldQuotes, positions, allQuestions] = await Promise.all([
    ensureActivePredictionQuestion(),
    listWorldQuotes(),
    simList<PredictionPosition>(FIRESTORE_SIM_COLLECTIONS.tianziPositions),
    simList<PredictionQuestion>(FIRESTORE_SIM_COLLECTIONS.tianziQuestions),
  ]);

  return {
    book: buildPredictionBook(question, worldQuotes),
    profilePositions: positions
      .filter((position) => !profileId || position.profileId === profileId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    question,
    recentQuestions: allQuestions
      .slice()
      .sort((left, right) => right.opensAt.localeCompare(left.opensAt))
      .slice(0, 8),
    worldQuotes,
  } satisfies TianziState;
}

export async function placePredictionStake(args: {
  callId?: string | null;
  externalMarketId?: string | null;
  profileId: string;
  questionId: string;
  selection: PredictionPosition["selection"];
  source?: PredictionPosition["source"];
  stake: number;
}) {
  const question = await simGet<PredictionQuestion>(
    FIRESTORE_SIM_COLLECTIONS.tianziQuestions,
    args.questionId,
  );
  if (!question || question.status !== "open") {
    throw new Error("That Tianzi question is no longer open");
  }

  const state = await getTianziState(args.profileId);
  const entryPrice = args.selection === "yes" ? state.book.yesPrice : state.book.noPrice;
  const stake = Math.max(1, Number(args.stake));
  const shares = stake / Math.max(entryPrice, 0.01);

  const position = await simUpsert(FIRESTORE_SIM_COLLECTIONS.tianziPositions, {
    callId: args.callId ?? null,
    createdAt: nowIso(),
    entryPrice,
    externalMarketId: args.externalMarketId ?? null,
    id: `prediction:${randomUUID()}`,
    profileId: args.profileId,
    questionId: question.id,
    realizedPnl: null,
    selection: args.selection,
    shares,
    source: args.source || "tianzi",
    stake,
    settledAt: null,
    updatedAt: nowIso(),
  } satisfies PredictionPosition);

  await creditRewards(args.profileId, Math.max(2, stake * 0.02), {
    badge: "Tianzi trader",
    reason: "prediction-stake",
  });

  return position;
}

async function ensurePerpMarkets() {
  const worlds = await ensureTokenWorlds();
  const openPositions = await simList<SimPerpPosition>(FIRESTORE_SIM_COLLECTIONS.nezhaPositions);
  const markets = await Promise.all(
    worlds.map(async (world) => {
      const id = `nezha:${world.id}`;
      const existing = await simGet<SimPerpMarket>(FIRESTORE_SIM_COLLECTIONS.nezhaMarkets, id);
      const quote = await getTokenWorldQuote(world);
      const positionOpenInterest = openPositions
        .filter((position) => position.marketId === id)
        .reduce((sum, position) => sum + Math.abs(position.quantity * position.markPrice), 0);
      const premium = (scoreEntity(id, getMinuteBucket()) - 0.5) * 0.02;
      const bookMidPrice = quote.priceUsd * (1 + premium);
      const markPrice = quote.priceUsd * 0.72 + bookMidPrice * 0.28;
      const fundingRateHourly = ((bookMidPrice - quote.priceUsd) / Math.max(quote.priceUsd, 0.000001)) * 0.5;

      return simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaMarkets, {
        asOf: nowIso(),
        bookMidPrice,
        createdAt: existing?.createdAt || nowIso(),
        fundingRateHourly,
        id,
        markPrice,
        openInterest: positionOpenInterest,
        priceSource: quote.source,
        referencePrice: quote.priceUsd,
        riskConfig: PERP_DEFAULT_RISK_CONFIG,
        title: `${world.displayName} perp`,
        updatedAt: nowIso(),
        worldId: world.id,
      } satisfies SimPerpMarket);
    }),
  );

  return markets.sort((left, right) => left.id.localeCompare(right.id));
}

function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: SimPerpPosition["side"],
  riskConfig: SimPerpMarket["riskConfig"],
) {
  const maintenanceBand = 1 / Math.max(leverage, 1) - riskConfig.maintenanceMargin;
  if (side === "long") {
    return entryPrice * (1 - Math.max(0.02, maintenanceBand));
  }

  return entryPrice * (1 + Math.max(0.02, maintenanceBand));
}

function getLiquidationTier(
  marginRatio: number,
  riskConfig: SimPerpMarket["riskConfig"],
): SimPerpPosition["liquidationTier"] {
  if (marginRatio <= riskConfig.highRiskMargin) {
    return "high_risk";
  }
  if (marginRatio <= riskConfig.backstopMargin) {
    return "backstop";
  }
  if (marginRatio <= riskConfig.maintenanceMargin) {
    return "maintenance";
  }
  if (marginRatio <= riskConfig.cancelMargin) {
    return "cancel_margin";
  }
  return "healthy";
}

async function refreshPerpPosition(position: SimPerpPosition, market: SimPerpMarket) {
  const direction = position.side === "long" ? 1 : -1;
  const pnlUnrealized = (market.markPrice - position.entryPrice) * position.quantity * direction;
  const notional = Math.abs(position.quantity * market.markPrice);
  const equity = position.marginUsed + pnlUnrealized;
  const marginRatio = notional > 0 ? equity / notional : 1;

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, {
    ...position,
    liquidationPrice: calculateLiquidationPrice(
      position.entryPrice,
      position.leverage,
      position.side,
      market.riskConfig,
    ),
    liquidationTier: getLiquidationTier(marginRatio, market.riskConfig),
    markPrice: market.markPrice,
    pnlUnrealized,
    updatedAt: nowIso(),
  } satisfies SimPerpPosition);
}

async function maybeRunLiquidation(position: SimPerpPosition) {
  if (position.liquidationTier !== "backstop" && position.liquidationTier !== "high_risk") {
    return position;
  }

  const bucket = getMinuteBucket();
  const liquidationId = `liquidation:${position.id}:${bucket}`;
  const existing = await simGet<SimPerpLiquidation>(
    FIRESTORE_SIM_COLLECTIONS.nezhaLiquidations,
    liquidationId,
  );
  if (existing) {
    return position;
  }

  const quantityClosed =
    position.liquidationTier === "high_risk" ? position.quantity : position.quantity * 0.5;
  await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaLiquidations, {
    createdAt: nowIso(),
    id: liquidationId,
    marketId: position.marketId,
    markPrice: position.markPrice,
    profileId: position.profileId,
    quantityClosed,
    side: position.side,
    tier: position.liquidationTier,
  } satisfies SimPerpLiquidation);

  if (quantityClosed >= position.quantity) {
    await simDelete(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, position.id);
    return null;
  }

  return simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, {
    ...position,
    marginUsed: position.marginUsed * ((position.quantity - quantityClosed) / position.quantity),
    quantity: position.quantity - quantityClosed,
    updatedAt: nowIso(),
  } satisfies SimPerpPosition);
}

async function applyFilledPerpOrder(
  market: SimPerpMarket,
  order: SimPerpOrder,
  fillPrice: number,
) {
  const existingPositions = await simFilter<SimPerpPosition>(
    FIRESTORE_SIM_COLLECTIONS.nezhaPositions,
    (position) => position.marketId === order.marketId && position.profileId === order.profileId,
  );
  const existing = existingPositions[0] || null;

  if (order.reduceOnly) {
    if (!existing || existing.side === order.side) {
      throw new Error("Reduce-only orders need an opposite-side position to reduce");
    }

    const remainingQuantity = Math.max(0, existing.quantity - order.quantity);
    if (remainingQuantity === 0) {
      await simDelete(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, existing.id);
    } else {
      await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, {
        ...existing,
        marginUsed: existing.marginUsed * (remainingQuantity / existing.quantity),
        quantity: remainingQuantity,
        updatedAt: nowIso(),
      } satisfies SimPerpPosition);
    }
  } else if (!existing) {
    await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, {
      createdAt: nowIso(),
      entryPrice: fillPrice,
      id: `position:${randomUUID()}`,
      leverage: order.leverage,
      liquidationPrice: calculateLiquidationPrice(
        fillPrice,
        order.leverage,
        order.side,
        market.riskConfig,
      ),
      liquidationTier: "healthy",
      marginUsed: Math.abs(order.quantity * fillPrice) / Math.max(order.leverage, 1),
      markPrice: market.markPrice,
      marketId: market.id,
      pnlUnrealized: 0,
      profileId: order.profileId,
      quantity: order.quantity,
      side: order.side,
      updatedAt: nowIso(),
    } satisfies SimPerpPosition);
  } else if (existing.side === order.side) {
    const combinedQuantity = existing.quantity + order.quantity;
    const entryPrice =
      (existing.entryPrice * existing.quantity + fillPrice * order.quantity) /
      Math.max(combinedQuantity, 0.000001);

    await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, {
      ...existing,
      entryPrice,
      leverage: Math.min(market.riskConfig.maxLeverage, Math.max(existing.leverage, order.leverage)),
      marginUsed:
        existing.marginUsed + Math.abs(order.quantity * fillPrice) / Math.max(order.leverage, 1),
      quantity: combinedQuantity,
      updatedAt: nowIso(),
    } satisfies SimPerpPosition);
  } else {
    const remainingQuantity = existing.quantity - order.quantity;
    if (remainingQuantity > 0) {
      await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, {
        ...existing,
        marginUsed: existing.marginUsed * (remainingQuantity / existing.quantity),
        quantity: remainingQuantity,
        updatedAt: nowIso(),
      } satisfies SimPerpPosition);
    } else if (remainingQuantity === 0) {
      await simDelete(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, existing.id);
    } else {
      await simDelete(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, existing.id);
      await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaPositions, {
        createdAt: nowIso(),
        entryPrice: fillPrice,
        id: `position:${randomUUID()}`,
        leverage: order.leverage,
        liquidationPrice: calculateLiquidationPrice(
          fillPrice,
          order.leverage,
          order.side,
          market.riskConfig,
        ),
        liquidationTier: "healthy",
        marginUsed: Math.abs(remainingQuantity * fillPrice) / Math.max(order.leverage, 1),
        markPrice: market.markPrice,
        marketId: market.id,
        pnlUnrealized: 0,
        profileId: order.profileId,
        quantity: Math.abs(remainingQuantity),
        side: order.side,
        updatedAt: nowIso(),
      } satisfies SimPerpPosition);
    }
  }

  await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaOrders, {
    ...order,
    limitPrice: order.limitPrice ?? null,
    status: "filled",
    updatedAt: nowIso(),
  } satisfies SimPerpOrder);
}

async function maybeFillLimitOrders(market: SimPerpMarket) {
  const openOrders = await simFilter<SimPerpOrder>(
    FIRESTORE_SIM_COLLECTIONS.nezhaOrders,
    (order) => order.marketId === market.id && order.status === "open",
  );

  await Promise.all(
    openOrders.map(async (order) => {
      const shouldFill =
        order.orderType === "market" ||
        (order.side === "long" && Number(order.limitPrice || 0) >= market.markPrice) ||
        (order.side === "short" && Number(order.limitPrice || 0) <= market.markPrice);

      if (shouldFill) {
        await applyFilledPerpOrder(
          market,
          order,
          order.orderType === "market" ? market.markPrice : Number(order.limitPrice || market.markPrice),
        );
      }
    }),
  );
}

export async function getNezhaState(profileId?: string | null) {
  const markets = await ensurePerpMarkets();
  await Promise.all(markets.map((market) => maybeFillLimitOrders(market)));

  const positions = await simList<SimPerpPosition>(FIRESTORE_SIM_COLLECTIONS.nezhaPositions);
  const refreshedPositions = await Promise.all(
    positions.map(async (position) => {
      const market = markets.find((entry) => entry.id === position.marketId);
      if (!market) {
        return position;
      }

      const refreshed = await refreshPerpPosition(position, market);
      return maybeRunLiquidation(refreshed);
    }),
  );

  const currentPositions = refreshedPositions.filter(Boolean) as SimPerpPosition[];
  const orders = await simList<SimPerpOrder>(FIRESTORE_SIM_COLLECTIONS.nezhaOrders);
  const liquidations = await simList<SimPerpLiquidation>(
    FIRESTORE_SIM_COLLECTIONS.nezhaLiquidations,
  );

  return {
    liquidations: liquidations
      .filter((event) => !profileId || event.profileId === profileId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 20),
    markets,
    orders: orders
      .filter((order) => !profileId || order.profileId === profileId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 40),
    positions: currentPositions
      .filter((position) => !profileId || position.profileId === profileId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  } satisfies NezhaState;
}

export async function placePerpOrder(args: {
  leverage: number;
  limitPrice?: number | null;
  marketId: string;
  orderType: SimPerpOrder["orderType"];
  profileId: string;
  quantity: number;
  reduceOnly: boolean;
  side: SimPerpOrder["side"];
}) {
  const markets = await ensurePerpMarkets();
  const market = markets.find((entry) => entry.id === args.marketId);
  if (!market) {
    throw new Error("Unknown Nezha market");
  }

  const leverage = clamp(args.leverage, 1, market.riskConfig.maxLeverage);
  const quantity = Math.max(0.0001, Number(args.quantity));
  const order = await simUpsert(FIRESTORE_SIM_COLLECTIONS.nezhaOrders, {
    createdAt: nowIso(),
    id: `order:${randomUUID()}`,
    leverage,
    limitPrice: args.limitPrice ?? null,
    marketId: market.id,
    orderType: args.orderType,
    profileId: args.profileId,
    quantity,
    reduceOnly: args.reduceOnly,
    side: args.side,
    status: "open",
    updatedAt: nowIso(),
  } satisfies SimPerpOrder);

  const shouldFill =
    order.orderType === "market" ||
    (order.side === "long" && Number(order.limitPrice || 0) >= market.markPrice) ||
    (order.side === "short" && Number(order.limitPrice || 0) <= market.markPrice);

  if (shouldFill) {
    await applyFilledPerpOrder(
      market,
      order,
      order.orderType === "market" ? market.markPrice : Number(order.limitPrice || market.markPrice),
    );
  }

  await creditRewards(args.profileId, Math.max(3, quantity * leverage * 0.6), {
    badge: "Nezha pilot",
    reason: "perp-order",
  });

  return simGet<SimPerpOrder>(FIRESTORE_SIM_COLLECTIONS.nezhaOrders, order.id);
}

async function writeGovernanceEligibilitySnapshot() {
  const profiles = await simList<IdentityProfile>(FIRESTORE_SIM_COLLECTIONS.identityProfiles);
  const eligibleProfiles = profiles
    .filter((profile) => profile.chain === "solana" || profile.chain === "bnb")
    .map((profile) => profile.id);

  return writeMerkleSnapshot("governanceEligibility", nowIso(), eligibleProfiles);
}

export async function verifyCamiupHolderTransfer(args: {
  profileId: string;
  transactionId: string;
  worldId: string;
}) {
  const [profile, worlds] = await Promise.all([
    simGet<IdentityProfile>(FIRESTORE_SIM_COLLECTIONS.identityProfiles, args.profileId),
    ensureTokenWorlds(),
  ]);
  if (!profile) {
    throw new Error("Load a profile before verifying a $CAMIUP transfer.");
  }

  const world = worlds.find((entry) => entry.id === args.worldId);
  if (!world || (world.chain !== "solana" && world.chain !== "bnb")) {
    throw new Error("That $CAMIUP world is not available for verification.");
  }

  if (!world.contractAddress) {
    throw new Error("That $CAMIUP world is missing its official token address.");
  }

  const verificationTarget = getWorldVerificationTarget(world);
  if (!args.transactionId.trim()) {
    throw new Error("Submit a confirmed transaction id to verify the holder tick.");
  }

  if (world.chain === "solana") {
    if (profile.chain !== "solana") {
      throw new Error("This profile does not map to a Solana wallet for the selected $CAMIUP world.");
    }

    const receipt = await verifySolanaTokenTransferToTarget({
      expectedFrom: profile.ownerWallet,
      expectedMint: world.contractAddress,
      expectedTarget: verificationTarget,
      requiredTokenAmount: 1,
      transactionId: args.transactionId,
    });
    if (!receipt.ok) {
      throw new Error(receipt.error || "Unable to verify the Solana $CAMIUP transfer.");
    }
  } else {
    if (
      profile.chain !== "bnb" &&
      profile.chain !== "ethereum"
    ) {
      throw new Error("This profile does not map to a BNB-compatible wallet for the selected $CAMIUP world.");
    }

    const receipt = await verifyBnbTokenTransferToTarget({
      expectedFrom: profile.ownerWallet,
      expectedTarget: verificationTarget,
      requiredTokenAmount: 1,
      tokenAddress: world.contractAddress,
      transactionId: args.transactionId,
    });
    if (!receipt.ok) {
      throw new Error(receipt.error || "Unable to verify the BNB $CAMIUP transfer.");
    }
  }

  await writeVerificationEvent({
    chain: world.chain,
    profileId: args.profileId,
    reason: "camiup_transfer",
    requiredTokenAmount: "1",
    tokenAddress: world.contractAddress,
    transactionId: args.transactionId,
    verificationTarget,
    verifiedWallet: profile.ownerWallet,
    worldId: world.id,
  });

  await syncHumanBitClawProfile(profile);
  await writeGovernanceEligibilitySnapshot();
  return getLoadedIdentityByProfileId(args.profileId);
}

export async function createGenDelveVoteIntent(args: {
  choice: GenDelveVoteIntent["choice"];
  profileId: string;
  worldId: string;
}) {
  const worlds = await ensureTokenWorlds();
  const world = worlds.find((entry) => entry.id === args.worldId);
  if (!world || !world.governanceEnabled) {
    throw new Error("That governance world is not active");
  }

  const profile = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    args.profileId,
  );
  if (!profile) {
    throw new Error("Load a profile before opening a governance vote.");
  }

  if (!world.contractAddress) {
    throw new Error("That governance world is missing its official token address.");
  }

  if (world.chain === "solana" && profile.chain !== "solana") {
    throw new Error("Load the Solana holder profile before opening a Solana $CAMIUP vote.");
  }

  if (
    world.chain === "bnb" &&
    profile.chain !== "bnb" &&
    profile.chain !== "ethereum"
  ) {
    throw new Error("Load the BNB-compatible holder profile before opening a BNB $CAMIUP vote.");
  }

  await writeGovernanceEligibilitySnapshot();
  return simUpsert(FIRESTORE_SIM_COLLECTIONS.genDelveVoteIntents, {
    chain: world.chain,
    choice: args.choice,
    createdAt: nowIso(),
    id: `vote:${randomUUID()}`,
    profileId: args.profileId,
    requiredTokenAmount: "1",
    status: "pending",
    updatedAt: nowIso(),
    verificationMemo: null,
    verificationTarget: getWorldVerificationTarget(world),
    verificationTransactionId: null,
    verificationTokenAddress: world.contractAddress,
    verifiedWallet: null,
    worldId: world.id,
  } satisfies GenDelveVoteIntent);
}

export async function verifyGenDelveVoteIntent(intentId: string, transactionId: string) {
  const intent = await simGet<GenDelveVoteIntent>(
    FIRESTORE_SIM_COLLECTIONS.genDelveVoteIntents,
    intentId,
  );
  if (!intent) {
    throw new Error("Governance intent not found");
  }

  const profile = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    intent.profileId,
  );
  if (!profile) {
    throw new Error("The governance profile could not be loaded.");
  }

  if (!transactionId.trim()) {
    throw new Error("Submit a real transaction id to verify the vote.");
  }

  if (intent.chain === "solana") {
    const receipt = await verifySolanaTokenTransferToTarget({
      expectedFrom: profile.ownerWallet,
      expectedMint: intent.verificationTokenAddress,
      expectedTarget: intent.verificationTarget,
      requiredTokenAmount: Number(intent.requiredTokenAmount),
      transactionId,
    });
    if (!receipt.ok) {
      throw new Error(receipt.error || "Unable to verify the Solana governance receipt.");
    }
  } else {
    const receipt = await verifyBnbTokenTransferToTarget({
      expectedFrom: profile.ownerWallet,
      expectedTarget: intent.verificationTarget,
      requiredTokenAmount: Number(intent.requiredTokenAmount),
      tokenAddress: intent.verificationTokenAddress,
      transactionId,
    });
    if (!receipt.ok) {
      throw new Error(receipt.error || "Unable to verify the BNB governance receipt.");
    }
  }

  await simUpsert(FIRESTORE_SIM_COLLECTIONS.genDelveVoteIntents, {
    ...intent,
    status: "verified",
    updatedAt: nowIso(),
    verificationTransactionId: transactionId,
    verifiedWallet: profile.ownerWallet,
  } satisfies GenDelveVoteIntent);
  await writeVerificationEvent({
    chain: intent.chain,
    profileId: intent.profileId,
    reason: "gendelve_vote",
    requiredTokenAmount: intent.requiredTokenAmount,
    tokenAddress: intent.verificationTokenAddress,
    transactionId,
    verificationTarget: intent.verificationTarget,
    verifiedWallet: profile.ownerWallet,
    worldId: intent.worldId,
  });
  await unlockRewards(intent.profileId, "gendelve_vote");
  await creditRewards(intent.profileId, 25, {
    badge: "GenDelve voter",
    reason: "verified-vote",
  });
  await writeGovernanceEligibilitySnapshot();
  return simGet<GenDelveVoteIntent>(FIRESTORE_SIM_COLLECTIONS.genDelveVoteIntents, intentId);
}

export async function createProfileOwnerChallenge(profileId: string) {
  const identity = await simGet<IdentityProfile>(
    FIRESTORE_SIM_COLLECTIONS.identityProfiles,
    profileId,
  );
  if (!identity) {
    throw new Error("Identity profile not found");
  }

  const challengeChain = getSupportedGovernanceChain(identity);
  if (!challengeChain) {
    throw new Error(
      "Owner challenges currently support Solana wallets and direct 0x EVM/BNB wallets.",
    );
  }

  return {
    chain: challengeChain,
    createdAt: nowIso(),
    memo: `PROFILE-OWNER-${sha256Hex(profileId).slice(0, 12)}`,
    profileId,
    recommendedWallet: identity.ownerWallet,
    verificationTarget:
      challengeChain === "solana"
        ? getServerEnv().TREASURY_WALLET
        : getBnbVerificationTarget(),
    verificationTransactionHint:
      challengeChain === "solana"
        ? "Send exactly 1 lamport to the treasury wallet with this memo attached."
        : `Send a BNB Chain transaction to ${getBnbVerificationTarget()} and place the memo below in the hex data field.`,
  } satisfies ProfileOwnerChallenge;
}

export async function verifyProfileOwnerChallenge(
  profileId: string,
  transactionId: string,
) {
  const challenge = await createProfileOwnerChallenge(profileId);

  if (!transactionId.trim()) {
    throw new Error("Submit a real transaction id to verify the owner challenge.");
  }

  if (challenge.chain === "solana") {
    const receipt = await verifyMemoTransferToTreasury(
      transactionId,
      BigInt(1),
      challenge.memo,
    );
    if (!receipt.ok) {
      throw new Error(receipt.error || "Unable to verify the Solana owner challenge.");
    }
    if (receipt.payerWallet !== challenge.recommendedWallet) {
      throw new Error("The owner challenge receipt does not match the profile wallet.");
    }
  } else {
    const receipt = await verifyBnbMemoTransaction({
      expectedFrom: challenge.recommendedWallet,
      expectedMemo: challenge.memo,
      transactionId,
    });
    if (!receipt.ok) {
      throw new Error(receipt.error || "Unable to verify the BNB owner challenge.");
    }
  }

  await writeVerificationEvent({
    chain: challenge.chain,
    profileId,
    reason: "profile_challenge",
    transactionId,
    verifiedWallet: challenge.recommendedWallet,
  });
  await unlockRewards(profileId, "profile_challenge");
  await creditRewards(profileId, 20, {
    badge: "Owner verified",
    reason: "profile-challenge",
  });
  return ensureRewardUnlock(profileId);
}

export async function applySupportVerificationOverride(profileId: string) {
  await writeVerificationEvent({
    chain: "support",
    profileId,
    reason: "support_override",
  });
  await unlockRewards(profileId, "support_override");
  await creditRewards(profileId, 15, {
    badge: "Support verified",
    reason: "support-override",
  });
  return ensureRewardUnlock(profileId);
}

export async function getGenDelveState(profileId?: string | null) {
  const [worlds, intents, currentLoadedIdentity] = await Promise.all([
    ensureTokenWorlds(),
    simList<GenDelveVoteIntent>(FIRESTORE_SIM_COLLECTIONS.genDelveVoteIntents),
    getCurrentLoadedIdentity(),
  ]);
  const effectiveProfileId = profileId || currentLoadedIdentity?.profile.id || null;

  return {
    intents: intents
      .filter((intent) => !effectiveProfileId || intent.profileId === effectiveProfileId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    ownerChallenge: effectiveProfileId
      ? await createProfileOwnerChallenge(effectiveProfileId).catch(() => null)
      : null,
    worlds: worlds.filter((world) => world.governanceEnabled),
  } satisfies GenDelveState;
}

export async function getBolClawState(): Promise<BolClawState> {
  const [loadedIdentity, heartbeat, bitClawState, tianzi, nezha, recentRequests] = await Promise.all([
    getCurrentLoadedIdentity(),
    getHeartbeatState(),
    getBitClawMainState(),
    getTianziState(),
    getNezhaState(),
    listAgentTradeRequests(),
  ]);

  const trendingProfiles = new Map<string, { count: number; profile: BitClawPost["profileId"] }>();
  for (const post of bitClawState.feed) {
    const existing = trendingProfiles.get(post.profileId) || { count: 0, profile: post.profileId };
    existing.count += 1;
    trendingProfiles.set(post.profileId, existing);
  }

  return {
    activeMasks: heartbeat.agents.slice(0, 12),
    feed: bitClawState.feed.slice(0, 16),
    loadedIdentity,
    nezha,
    pasteTrade: getPasteTradeIntegration(null),
    recentRequests: recentRequests.slice(0, 10),
    tianzi,
    trendingProfiles: [...trendingProfiles.values()]
      .sort((left, right) => right.count - left.count)
      .map((entry) => bitClawState.profiles.find((profile) => profile.id === entry.profile))
      .filter((profile): profile is BitClawProfile => Boolean(profile))
      .slice(0, 8),
    worlds: tianzi.worldQuotes,
  };
}

export async function getTianshiDiagnosticsState() {
  await warmHyperliquidAgentAbility().catch(() => null);
  const [loadedIdentity, heartbeat, merkleSnapshots, botBindings, hybridFutarchy, percolator, polymarketMarkets] = await Promise.all([
    getCurrentLoadedIdentity(),
    getHeartbeatState(),
    simList<MerkleSnapshotRecord>(FIRESTORE_SIM_COLLECTIONS.merkleSnapshots),
    listBotBindings(),
    getHybridFutarchyState(),
    getPercolatorState(),
    syncPolymarketMarketSnapshots(8),
  ]);
  const dexter = getDexterAgentStatus();
  const godmode = getGodmodeAgentStatus();
  const agfund = getAgFundAgentStatus();
  const fourMeme = getFourMemeAgentStatus();
  const gmgn = getGmgnStatus();
  const hyperliquid = getHyperliquidAgentStatus();
  const polymarket = getPolymarketAgentStatus();
  const reportCommerce = getAutonomousReportCommercePolicy();

  return {
    agentAbilities: [
      {
        detail: dexter.enabled
          ? `mode=${dexter.defaultMode} network=${dexter.defaultNetwork} ready=${dexter.cliReady}`
          : "disabled",
        label: "Dexter",
        status: dexter.enabled && dexter.cliReady ? "ready" : "gated",
      },
      {
        detail: godmode.note || `model=${godmode.defaultModel}`,
        label: "G0DM0D3",
        status: godmode.enabled && godmode.apiReady ? "ready" : "gated",
      },
      {
        detail: agfund.note || agfund.marketplaceUrl,
        label: "AgFund",
        status: agfund.enabled ? (agfund.apiReady ? "ready" : "visible") : "gated",
      },
      {
        detail: fourMeme.note || fourMeme.agenticUrl,
        label: "Four.meme",
        status: fourMeme.enabled ? "ready" : "gated",
      },
      {
        detail: gmgn.sharedKeyEnabled
          ? `${gmgn.apiHost} / ${gmgn.toolFamilies.join(", ")} / ${
              gmgn.criticalAuthReady ? "critical auth ready" : "query-only"
            }`
          : "disabled",
        label: "GMGN",
        status: gmgn.sharedKeyEnabled
          ? gmgn.criticalAuthReady
            ? "shared-key"
            : "read-only"
          : "gated",
      },
      {
        detail: hyperliquid.enabled
          ? `${hyperliquid.apiUrl} / ${hyperliquid.infoReady ? "info ready" : "info waiting"} / ${
              hyperliquid.livePerpsEnabled
                ? "shared perp lane live"
                : hyperliquid.apiWalletApproved
                  ? "api wallet approved"
                  : "live gated"
            }`
          : "disabled",
        label: "Hyperliquid",
        status: hyperliquid.enabled
          ? hyperliquid.livePerpsEnabled
            ? "live-capable"
            : hyperliquid.infoReady
              ? "read-only"
              : "gated"
          : "gated",
      },
      {
        detail: polymarket.note || `mode=${polymarket.defaultMode}`,
        label: "Polymarket",
        status:
          polymarket.enabled && polymarket.readOnlyReady
            ? polymarket.liveReady
              ? "live-capable"
              : "read-only"
            : "gated",
      },
      {
        detail: reportCommerce.enabled
          ? `${reportCommerce.priceUsdc.toFixed(2)} USDC, ${reportCommerce.purchaseWindowSeconds}s window, ${reportCommerce.postPurchaseTradeDelaySeconds}s delay`
          : "disabled",
        label: "x402 reports",
        status: reportCommerce.enabled ? "timed-window" : "gated",
      },
    ],
    botBindings: botBindings.slice(0, 12),
    diagnostics: [
      {
        label: "Runtime loop",
        value: "services/tianshi-automaton/runtime-loop.ts",
      },
      {
        label: "Repository seam",
        value: "lib/server/repository.ts",
      },
      {
        label: "Chart seam",
        value: "lib/server/chart.ts",
      },
      {
        label: "Governance owner",
        value: getSimulationOwnerWallet(),
      },
    ],
    heartbeat,
    hybridFutarchy,
    loadedIdentity,
    merkleSnapshots: merkleSnapshots
      .slice()
      .sort((left, right) => right.checkpointAt.localeCompare(left.checkpointAt))
      .slice(0, 12),
    percolator,
    polymarketMarkets: polymarketMarkets.slice(0, 8),
  };
}

export async function buildTianezhaChatReply(message: string) {
  const normalized = message.trim().toLowerCase();
  await warmHyperliquidAgentAbility().catch(() => null);
  const [loadedIdentity, tianzi, nezha, heartbeat] = await Promise.all([
    getCurrentLoadedIdentity(),
    getTianziState(),
    getNezhaState(),
    getHeartbeatState(),
  ]);
  const gmgn = getGmgnStatus();
  const hyperliquid = getHyperliquidAgentStatus();

  if ((normalized.includes("gmgn") || normalized.includes("hyperliquid") || normalized.includes("perp")) && !loadedIdentity) {
    if (normalized.includes("hyperliquid") || normalized.includes("perp")) {
      return hyperliquid.enabled
        ? `Hyperliquid perps are exposed through Tianshi's shared lane at ${hyperliquid.apiUrl}. Info surface: ${hyperliquid.infoReady ? "ready" : "waiting on probe"}. ${hyperliquid.livePerpsEnabled ? "The shared API wallet is approved and live perp routing is enabled." : hyperliquid.apiWalletApproved ? "The shared API wallet is approved, but live perp routing is still gated." : "Live perp routing is still gated until the shared API wallet is approved."} Load a profile if you want holder-tick or cockpit guidance for a specific wallet.`
        : "Hyperliquid perps are not configured yet. Once the shared Tianshi lane is configured, agents can read perp market state and only turn on live routing after the approved API wallet is present.";
    }

    return gmgn.sharedKeyEnabled
      ? `GMGN is wired into Tianezha with one shared Tianshi API key at ${gmgn.apiHost}. Tool families: ${gmgn.toolFamilies.join(", ")}. Query chains: ${gmgn.queryChains.join(", ")}. Load a profile if you want deploy-gate or holder-tick guidance for a specific wallet.`
      : "GMGN is not configured yet. Once the shared Tianshi API key is present, the chatbot can expose the GMGN query surface even before a holder profile is loaded.";
  }

  if (!loadedIdentity) {
    return "Load an address or registry name first. Once a profile is loaded, I can explain the two token worlds, the active prediction question, your reward lock state, and the current Nezha mark prices.";
  }

  if (normalized.includes("gmgn")) {
    const deployLine = loadedIdentity.verification.canDeployAgent
      ? "This loaded profile already has the holder tick and can deploy a cockpit-backed agent."
      : "This loaded profile does not have the holder tick yet, so cockpit deployment stays locked until a confirmed 1 $CAMIUP transfer is verified on Solana or BNB.";
    return gmgn.sharedKeyEnabled
      ? `GMGN is wired into Tianezha with one shared Tianshi API key at ${gmgn.apiHost}. Tool families: ${gmgn.toolFamilies.join(", ")}. Query chains: ${gmgn.queryChains.join(", ")}. ${gmgn.criticalAuthReady ? "Critical trade auth is ready." : "Critical trade auth is not ready yet, so GMGN stays query-only."} ${deployLine}`
      : "GMGN is not configured yet. Once the shared Tianshi API key is present, the chatbot and holder-deployed agents can use the GMGN query surface, and critical trade routes activate only when GMGN auth signing is configured.";
  }

  if (normalized.includes("hyperliquid")) {
    return hyperliquid.enabled
      ? `Hyperliquid perps are exposed through Tianshi's shared lane at ${hyperliquid.apiUrl}. ${hyperliquid.infoReady ? "Perp market data is reachable." : "Perp market data is still waiting on probe results."} ${hyperliquid.livePerpsEnabled ? "The shared API wallet is approved and live perp routing is enabled for agents." : hyperliquid.apiWalletApproved ? "The shared API wallet is approved, but live perp routing is still gated." : "Live perp routing is still gated until the shared API wallet is approved."}`
      : "Hyperliquid perps are not configured yet. Once the shared Tianshi lane is configured, agents can query perp market state and stage live routing behind the approved API wallet.";
  }

  if (normalized.includes("reward") || normalized.includes("claim")) {
    return loadedIdentity.rewardUnlock.claimsUnlocked
      ? `Claims are unlocked for ${loadedIdentity.profile.displayName}. Available rewards: ${loadedIdentity.rewardLedger.availableRewards.toFixed(2)}.`
      : `Rewards are still locked for ${loadedIdentity.profile.displayName}. Use a verified GenDelve vote or a profile-owner challenge to unlock ${loadedIdentity.rewardLedger.lockedRewards.toFixed(2)} locked rewards.`;
  }

  if (normalized.includes("deploy") || normalized.includes("holder tick")) {
    const targets = Object.entries(loadedIdentity.verification.holderVerificationTargets)
      .map(([chain, target]) => `${chain}:${target}`)
      .join(" | ");
    return loadedIdentity.verification.canDeployAgent
      ? `The holder tick is live for ${loadedIdentity.profile.displayName}. Deploy permission is enabled, and any personal agent cockpit inherits AgFund metadata, the x402 report window, and the shared GMGN surface.`
      : `Deploy permission is still locked. Verify a confirmed 1 $CAMIUP transfer from the profile wallet to the static holder targets (${targets}) on the matching chain, then Tianezha will award the tick and unlock cockpit deployment.`;
  }

  if (normalized.includes("predict") || normalized.includes("tianzi")) {
    return `Tianzi is currently running: "${tianzi.question.title}" YES at ${(tianzi.book.yesPrice * 100).toFixed(1)}%. The window closes at ${new Date(tianzi.question.closesAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`;
  }

  if (normalized.includes("perp") || normalized.includes("nezha")) {
    const marketLine = nezha.markets
      .map((market) => `${market.title}: mark $${market.markPrice.toFixed(4)}, funding ${(market.fundingRateHourly * 100).toFixed(2)}%/hr`)
      .join(" | ");
    return hyperliquid.enabled
      ? `Nezha still mirrors liquidation and funding locally for simulation, while agents inherit Hyperliquid perp market access through Tianshi at ${hyperliquid.apiUrl}. ${hyperliquid.livePerpsEnabled ? "The shared API wallet lane is live." : "The shared API wallet lane is still gated."} ${marketLine}`
      : `Nezha is simulation-only. ${marketLine}`;
  }

  if (normalized.includes("heartbeat") || normalized.includes("agent")) {
    return `Heartbeat currently leases exactly ${heartbeat.snapshot.activeAgentIds.length} RA agents. The active masks rotate every 10 minutes, and the current Merkle root is ${heartbeat.snapshot.merkleRoot.slice(0, 16)}...`;
  }

  return `Loaded profile: ${loadedIdentity.profile.displayName} on ${loadedIdentity.profile.chain}. Current prompt: "${tianzi.question.title}". Nezha is tracking ${nezha.markets.length} simulation markets, and Heartbeat has ${heartbeat.snapshot.activeAgentIds.length} active agents right now.`;
}

let heartbeatLoopStarted = false;

export function startSimulationHeartbeatLoop() {
  if (heartbeatLoopStarted) {
    return;
  }

  heartbeatLoopStarted = true;
  void ensureHeartbeatSnapshot();

  setInterval(() => {
    void ensureHeartbeatSnapshot();
  }, HEARTBEAT_INTERVAL_MINUTES * 60_000);
}
