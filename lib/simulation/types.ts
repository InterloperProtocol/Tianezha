export type ChainFamily = "solana" | "ethereum" | "bnb" | "bitcoin" | "other";

export type IdentitySourceKind =
  | "address"
  | "ens"
  | "sns"
  | "spaceid"
  | "manual";

export type RewardUnlockReason =
  | "locked"
  | "camiup_transfer"
  | "gendelve_vote"
  | "profile_challenge"
  | "support_override";

export type PredictionSide = "yes" | "no";

export type SimPerpSide = "long" | "short";

export type SimOrderType = "market" | "limit";

export type SimPerpLiquidationTier =
  | "healthy"
  | "cancel_margin"
  | "maintenance"
  | "backstop"
  | "high_risk";

export type GovernanceChoice = "support" | "oppose";

export type AgentWalletChain = "solana" | "ethereum" | "bnb" | "polygon";

export type AgentWalletPurpose =
  | "dexter-sniping"
  | "prediction-markets"
  | "bnb-execution"
  | "hyperliquid-perps"
  | "settlement";

export type AgentPredictionSource = "tianzi" | "polymarket";

export type AgentTradeRequestKind = "paste-trade" | "prediction-market";

export type AgentTradeRequestMarketScope =
  | "pump.fun"
  | "four.meme"
  | "polygon-prediction"
  | "mixed";

export type MerkleSnapshotKind =
  | "governanceEligibility"
  | "rewardSet"
  | "heartbeatActiveSet"
  | "maskRotationSet"
  | "leaderboardCheckpoint"
  | "socialFeedDigest";

export interface ProfileWallDisclaimer {
  lines: string[];
  title: string;
}

export interface IdentityProfile {
  avatarSeed: string;
  badges: string[];
  bio: string;
  bitClawProfileId: string;
  chain: ChainFamily;
  createdAt: string;
  displayName: string;
  id: string;
  nameService: IdentitySourceKind;
  normalizedAddress: string;
  ownerWallet: string;
  publicLabel: string;
  rank: number;
  simulationHandle: string;
  sourceKind: IdentitySourceKind;
  updatedAt: string;
  walletAddress: string;
}

export interface IdentityAlias {
  alias: string;
  chain: ChainFamily;
  createdAt: string;
  id: string;
  profileId: string;
  reservedToWallet: string;
  sourceKind: IdentitySourceKind;
  updatedAt: string;
}

export interface ProfileVerificationState {
  canDeployAgent: boolean;
  hasEligibleCamiupHolding: boolean;
  holderVerificationMode: "camiup_transfer";
  holderVerificationTargets: Partial<Record<"solana" | "bnb", string>>;
  isVerifiedOwner: boolean;
  lastVerifiedActionAt?: string | null;
  profileId: string;
  verificationTick: boolean;
  verifiedActionCount: number;
  verifiedHolderChains: Array<"solana" | "bnb">;
  verifiedHolderWorldIds: string[];
  verifiedHolderWorlds: VerifiedHolderWorld[];
}

export interface RewardUnlockState {
  claimsUnlocked: boolean;
  id: string;
  lastVerifiedActionAt?: string | null;
  profileId: string;
  reason: RewardUnlockReason;
  requiresGovernanceParticipation: boolean;
  updatedAt: string;
  verifiedActionCount: number;
}

export interface RewardLedger {
  availableRewards: number;
  badges: string[];
  id: string;
  lockedRewards: number;
  pendingRewards: number;
  profileId: string;
  rank: number;
  streak: number;
  totalRewards: number;
  updatedAt: string;
}

export interface BenchmarkQuote {
  asOf: string;
  change24hPct?: number | null;
  priceUsd: number;
  source: string;
  symbol: "BTC" | "ETH" | "SOL" | "BNB";
}

export interface TokenWorld {
  benchmarkSymbol: "SOL" | "BNB";
  benchmarkTicker: "SOLUSDT" | "BNBUSDT";
  chain: "solana" | "bnb";
  contractAddress: string | null;
  createdAt: string;
  displayName: string;
  governanceEnabled: boolean;
  id: string;
  launchVenue: "pump.fun" | "four.meme";
  questionPromptLabel: string;
  symbol: "$CAMIUP";
  totalSupply: number;
  updatedAt: string;
}

export interface SimulationBalance {
  actualHoldings: number;
  actualHoldingsSource: "configured" | "not_configured" | "lookup_failed";
  baselineHoldings: number;
  pendingRewards: number;
  simulatedHoldings: number;
  symbol: string;
  totalRewards: number;
  worldId: string;
}

export interface VerifiedHolderWorld {
  actualHoldings: number;
  actualHoldingsSource: SimulationBalance["actualHoldingsSource"];
  chain: "solana" | "bnb";
  isEligible: boolean;
  launchVenue: "pump.fun" | "four.meme";
  symbol: "$CAMIUP";
  verificationTarget?: string | null;
  verificationTransactionId?: string | null;
  verifiedAt?: string | null;
  worldId: string;
}

export interface LoadedIdentity {
  aliases: IdentityAlias[];
  balances: SimulationBalance[];
  benchmarks: BenchmarkQuote[];
  botBindings: BotBinding[];
  loadedAt: string;
  profile: IdentityProfile;
  rewardLedger: RewardLedger;
  rewardUnlock: RewardUnlockState;
  verification: ProfileVerificationState;
  wallDisclaimer: ProfileWallDisclaimer;
}

export interface RAAgentIdentity {
  canonicalName: string;
  chainAffinity: ChainFamily;
  cooldownUntil?: string | null;
  createdAt: string;
  id: string;
  lastActiveAt?: string | null;
  lastMaskId?: string | null;
  simulationHandle: string;
  sourceKind: IdentitySourceKind;
  updatedAt: string;
}

export interface AgentWalletRecord {
  address: string;
  agentId: string;
  assignedBy: string;
  chain: AgentWalletChain;
  createdAt: string;
  id: string;
  isPublic: boolean;
  profileId: string;
  purpose: AgentWalletPurpose;
  updatedAt: string;
}

export interface HolderDeployedAgent {
  agfundMarketplaceUrl: string;
  createdAt: string;
  displayName: string;
  gmgnApiHost: string | null;
  gmgnCriticalAuthReady: boolean;
  gmgnQueryChains: string[];
  gmgnSharedKeyEnabled: boolean;
  gmgnToolFamilies: string[];
  hyperliquidApiUrl: string | null;
  hyperliquidApiWallet: string | null;
  hyperliquidApiWalletApproved: boolean;
  hyperliquidInfoReady: boolean;
  hyperliquidLivePerpsEnabled: boolean;
  hyperliquidMasterWallet: string | null;
  hyperliquidWsUrl: string | null;
  id: string;
  ownerProfileId: string;
  ownerWallet: string;
  perpVenue: "hyperliquid";
  predictionNetwork: "polygon";
  reportBuyWindowSeconds: number;
  reportPriceUsdc: number;
  reportTradeDelaySeconds: number;
  sellKnowledgeBaseEnabled: boolean;
  status: "draft" | "active" | "paused";
  strategySummary: string;
  tradeGoal: string;
  tradingVenues: Array<"pump.fun" | "four.meme">;
  updatedAt: string;
  verificationTick: boolean;
  wallets: AgentWalletRecord[];
}

export interface PasteTradeIntegration {
  boardUrl: string;
  note: string;
  predictionVenue: "polymarket";
  repoUrl: string;
  supportedVenues: string[];
  tradeCommandExample: string;
  updateCommandExample: string;
}

export interface AgentTradeRequest {
  body: string;
  createdAt: string;
  id: string;
  kind: AgentTradeRequestKind;
  marketScope: AgentTradeRequestMarketScope;
  profileId: string;
  requesterProfileId?: string | null;
  sourceUrl?: string | null;
  status: "open" | "queued" | "closed";
  title: string;
  updatedAt: string;
}

export interface ProfileMask {
  cadenceMinutes: number;
  createdAt: string;
  description: string;
  id: string;
  label: string;
  updatedAt: string;
}

export interface HeartbeatLease {
  agentId: string;
  expiresAt: string;
  id: string;
  leasedAt: string;
  snapshotId: string;
}

export interface Heartbeat42Snapshot {
  activeAgentIds: string[];
  createdAt: string;
  eligiblePostAgentIds: string[];
  id: string;
  maskAssignments: Record<string, string>;
  merkleRoot: string;
  tickMinute: number;
  tickStartAt: string;
}

export interface PredictionResolution {
  explanation: string;
  resolvedAt: string;
  result: "yes" | "no" | "invalid";
}

export interface PredictionQuestion {
  closesAt: string;
  createdAt: string;
  description: string;
  id: string;
  opensAt: string;
  resolution?: PredictionResolution;
  startPrices: Record<string, number>;
  status: "open" | "resolved";
  templateIndex: number;
  title: string;
  updatedAt: string;
  worldIds: string[];
}

export interface PredictionBook {
  asOf: string;
  noLiquidity: number;
  noPrice: number;
  questionId: string;
  source: string;
  spreadBps: number;
  yesLiquidity: number;
  yesPrice: number;
}

export interface PredictionPosition {
  callId?: string | null;
  createdAt: string;
  entryPrice: number;
  externalMarketId?: string | null;
  id: string;
  profileId: string;
  questionId: string;
  realizedPnl?: number | null;
  selection: PredictionSide;
  shares: number;
  source?: AgentPredictionSource;
  stake: number;
  settledAt?: string | null;
  updatedAt: string;
}

export interface AgentPredictionCall {
  agentId: string;
  askHumansToParticipate: boolean;
  conviction: "low" | "medium" | "high";
  createdAt: string;
  expiresAt: string;
  id: string;
  profileId: string;
  question: string;
  rationale: string;
  settlementStatus: "open" | "won" | "lost" | "void";
  side: PredictionSide;
  source: AgentPredictionSource;
  targetId: string;
  targetUrl?: string | null;
  updatedAt: string;
}

export interface AgentTipCommitment {
  agentId: string;
  committedAmount: number;
  createdAt: string;
  fundingChain: AgentWalletChain;
  fundingSymbol: string;
  id: string;
  profileId: string;
  profitShareBps: number;
  returnedProfit: number;
  status: "active" | "paused" | "closed";
  tipperProfileId: string;
  tipperWallet: string;
  updatedAt: string;
}

export interface AgentProfitShareRecord {
  agentId: string;
  createdAt: string;
  id: string;
  profileId: string;
  questionOrMarketId: string;
  realizedProfit: number;
  source: AgentPredictionSource;
  sourcePositionId: string;
  tipCommitmentId: string;
  tipperShare: number;
}

export interface PerpRiskConfig {
  backstopMargin: number;
  cancelMargin: number;
  highRiskMargin: number;
  initialMargin: number;
  maintenanceMargin: number;
  maxLeverage: number;
}

export interface SimPerpMarket {
  asOf: string;
  bookMidPrice: number;
  createdAt: string;
  fundingRateHourly: number;
  id: string;
  markPrice: number;
  openInterest: number;
  priceSource: string;
  referencePrice: number;
  riskConfig: PerpRiskConfig;
  title: string;
  updatedAt: string;
  worldId: string;
}

export interface SimPerpOrder {
  createdAt: string;
  id: string;
  leverage: number;
  limitPrice?: number | null;
  marketId: string;
  orderType: SimOrderType;
  profileId: string;
  quantity: number;
  reduceOnly: boolean;
  side: SimPerpSide;
  status: "open" | "filled" | "cancelled";
  updatedAt: string;
}

export interface SimPerpPosition {
  createdAt: string;
  entryPrice: number;
  id: string;
  leverage: number;
  liquidationPrice: number;
  liquidationTier: SimPerpLiquidationTier;
  marginUsed: number;
  markPrice: number;
  marketId: string;
  pnlUnrealized: number;
  profileId: string;
  quantity: number;
  side: SimPerpSide;
  updatedAt: string;
}

export interface SimPerpLiquidation {
  createdAt: string;
  id: string;
  marketId: string;
  markPrice: number;
  profileId: string;
  quantityClosed: number;
  side: SimPerpSide;
  tier: SimPerpLiquidationTier;
}

export interface GenDelveVoteIntent {
  chain: "solana" | "bnb";
  choice: GovernanceChoice;
  createdAt: string;
  id: string;
  profileId: string;
  requiredTokenAmount: string;
  status: "pending" | "verified";
  updatedAt: string;
  verificationMemo?: string | null;
  verificationTarget: string;
  verificationTransactionId?: string | null;
  verificationTokenAddress: string;
  verifiedWallet?: string | null;
  worldId: string;
}

export interface ProfileOwnerChallenge {
  chain: "solana" | "bnb";
  createdAt: string;
  memo: string;
  profileId: string;
  recommendedWallet: string;
  verificationTarget: string;
  verificationTransactionHint: string;
}

export interface RewardGrantEvent {
  createdAt: string;
  effectiveReward: number;
  id: string;
  percolatorH: number;
  plannedReward: number;
  profileId: string;
  reason: string;
}

export interface BadgeEvent {
  badge: string;
  category: string;
  createdAt: string;
  id: string;
  profileId: string;
  reason: string;
}

export interface RankStateRecord {
  createdAt: string;
  id: string;
  label: string;
  profileId: string;
  rank: number;
  totalRewards: number;
  updatedAt: string;
}

export interface VerificationEvent {
  chain: "solana" | "bnb" | "support";
  createdAt: string;
  id: string;
  profileId: string;
  reason: RewardUnlockReason;
  requiredTokenAmount?: string | null;
  tokenAddress?: string | null;
  transactionId?: string | null;
  verificationTarget?: string | null;
  verifiedWallet?: string | null;
  worldId?: string | null;
}

export interface BotBinding {
  createdAt: string;
  displayName?: string | null;
  externalUserId: string;
  id: string;
  identityProfileId: string;
  loadedSessionId?: string | null;
  platform: "telegram" | "wechat";
  status: "bound" | "disabled";
  updatedAt: string;
}

export interface PolymarketMarketSnapshot {
  active: boolean;
  closeTime?: string | null;
  createdAt: string;
  id: string;
  liquidity: number;
  noPrice: number | null;
  question: string;
  slug?: string | null;
  updatedAt: string;
  url: string;
  volume: number;
  yesPrice: number | null;
}

export interface HybridFutarchyWorldScore {
  displayName: string;
  finalScore: number;
  futarchyShare: number;
  governanceShare: number;
  revenueShare: number;
  worldId: string;
}

export interface HybridFutarchyState {
  leaderWorldId: string | null;
  updatedAt: string;
  weights: {
    futarchy: number;
    governance: number;
    revenue: number;
  };
  worlds: HybridFutarchyWorldScore[];
}

export interface PercolatorState {
  effectiveBenefitMultiplier: number;
  h: number;
  requestedCompetitiveBudget: number;
  safeCompetitiveBudget: number;
  updatedAt: string;
}

export interface MerkleSnapshotRecord {
  checkpointAt: string;
  createdAt: string;
  entityIds: string[];
  id: string;
  kind: MerkleSnapshotKind;
  leafCount: number;
  root: string;
}
