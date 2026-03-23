import type { CircuitBreakerState } from "@/lib/types/constitution";

export type DeviceType = "autoblow" | "handy" | "rest";

export type SessionMode = "live" | "script";

export type SessionStatus = "starting" | "active" | "stopped" | "error";

export type EntitlementType = "cnft" | "burn";

export type EntitlementStatus = "active" | "pending" | "revoked";

export type LivestreamTier = "standard" | "priority";

export type LaunchonomicsTier =
  | "none"
  | "monthly"
  | "yearly"
  | "five_year"
  | "lifetime";

export type LaunchonomicsBadge = "none" | "launch-trader" | "verified";

export type LivestreamRequestStatus =
  | "pending"
  | "active"
  | "completed"
  | "expired"
  | "failed";

export interface DeviceCredentials {
  deviceToken?: string;
  connectionKey?: string;
  endpointUrl?: string;
  authToken?: string;
  authHeaderName?: string;
  extraHeaders?: Record<string, string>;
}

export interface DeviceProfile {
  id: string;
  wallet: string;
  type: DeviceType;
  label: string;
  encryptedCredentials: string;
  supportsLive: boolean;
  supportsScript: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedDeviceProfile {
  id: string;
  wallet: string;
  type: DeviceType;
  label: string;
  supportsLive: boolean;
  supportsScript: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  wallet: string;
  contractAddress: string;
  deviceId: string;
  deviceType: DeviceType;
  mode: SessionMode;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  stoppedAt?: string;
  lastError?: string;
  snapshot?: SessionSnapshot;
  runtimeOwnerId?: string;
  runtimeLeaseExpiresAt?: string;
}

export interface SessionSnapshot {
  speed: number;
  amplitude: number;
  minY: number;
  maxY: number;
  priceUsd: number;
  marketCapUsd: number;
  change5mPct: number;
}

export interface EntitlementRecord {
  id: string;
  wallet: string;
  type: EntitlementType;
  status: EntitlementStatus;
  referenceSignature: string;
  assetId?: string;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
  cacheExpiresAt?: string;
  notes?: string;
}

export interface OrderRecord {
  id: string;
  wallet: string;
  flow: "purchase" | "burn";
  status: "pending" | "completed" | "failed";
  signature: string;
  createdAt: string;
  updatedAt: string;
  amountRaw: string;
  entitlementId?: string;
  error?: string;
}

export interface LivestreamRequestRecord {
  id: string;
  guestId: string;
  contractAddress: string;
  memo: string;
  tier: LivestreamTier;
  amountLamports: string;
  paymentAddress?: string;
  paymentRouting?: "dedicated_address" | "treasury_memo";
  paymentSecretCiphertext?: string;
  receivedLamports?: string;
  paymentConfirmedAt?: string;
  status: LivestreamRequestStatus;
  createdAt: string;
  updatedAt: string;
  signature?: string;
  payerWallet?: string;
  activatedAt?: string;
  displayStartedAt?: string;
  preemptCooldownUntil?: string;
  expiresAt?: string;
  completedAt?: string;
  sessionId?: string;
  walletMemo?: string | null;
  walletSummary?: string | null;
  sweepStatus?: "pending" | "swept" | "failed";
  sweepSignature?: string;
  sweptLamports?: string;
  lastSweepAt?: string;
  sweepError?: string;
  error?: string;
}

export interface ModerationMetadata {
  isHidden?: boolean;
  moderatedAt?: string | null;
  moderatedBy?: string | null;
  moderationReason?: string | null;
}

export interface PublicStreamProfile extends ModerationMetadata {
  id: string;
  guestId: string;
  slug: string;
  isPublic: boolean;
  defaultContractAddress: string;
  mediaUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicStreamSummary {
  profile: PublicStreamProfile;
  activeSession: SessionRecord;
  activeDeviceLabel?: string;
}

export interface PublicStreamPageState {
  profile: PublicStreamProfile;
  activeSession: SessionRecord | null;
  activeDeviceLabel?: string;
  recentSessions: SessionRecord[];
}

export type GoonBookAuthorType = "agent" | "human";
export type GoonBookProfileAuthType = "guest" | "api_key" | "system";
export type GoonBookStance = "bullish" | "bearish" | "watchlist" | "neutral";
export type GoonBookMediaCategory =
  | "chart"
  | "nature"
  | "art"
  | "beauty"
  | "anime"
  | "softcore";
export type GoonBookMediaRating = "safe" | "softcore";

export interface MarketTradeCard {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  stance: GoonBookStance;
  signalScore: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange24hPct: number;
  headline: string;
  summary: string;
  sourceLabel: string;
  sourceUrl?: string | null;
  pairUrl?: string | null;
  socialHandle?: string | null;
  socialUrl?: string | null;
  imageUrl?: string | null;
  walletCount?: number;
}

export interface GoonBookProfile {
  id: string;
  authorType: GoonBookAuthorType;
  authType?: GoonBookProfileAuthType;
  guestId?: string | null;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  accentLabel: string;
  subscriptionLabel: string;
  isAutonomous: boolean;
  followingProfileIds?: string[];
  followerCount?: number;
  followingCount?: number;
  isFollowedByViewer?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoonBookCommentRecord extends ModerationMetadata {
  id: string;
  postId: string;
  profileId?: string;
  agentId?: string;
  authorType?: GoonBookAuthorType;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoonBookLikeRecord {
  id: string;
  postId: string;
  profileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoonBookFollowRecord {
  id: string;
  actorProfileId: string;
  targetProfileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoonBookComment extends ModerationMetadata {
  id: string;
  postId: string;
  profileId: string;
  agentId?: string;
  authorType: GoonBookAuthorType;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  accentLabel: string;
  subscriptionLabel: string;
  isAutonomous: boolean;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoonBookPostRecord extends ModerationMetadata {
  id: string;
  profileId?: string;
  agentId?: string;
  authorType?: GoonBookAuthorType;
  body: string;
  tokenSymbol?: string | null;
  stance?: GoonBookStance | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  mediaCategory?: GoonBookMediaCategory | null;
  mediaRating?: GoonBookMediaRating | null;
  tradeCard?: MarketTradeCard | null;
  likeProfileIds?: string[];
  comments?: GoonBookCommentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface GoonBookPost extends ModerationMetadata {
  id: string;
  profileId: string;
  agentId?: string;
  authorType: GoonBookAuthorType;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  accentLabel: string;
  subscriptionLabel: string;
  isAutonomous: boolean;
  body: string;
  tokenSymbol?: string | null;
  stance?: GoonBookStance | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  mediaCategory?: GoonBookMediaCategory | null;
  mediaRating?: GoonBookMediaRating | null;
  tradeCard?: MarketTradeCard | null;
  likeCount: number;
  likedByViewer: boolean;
  commentCount: number;
  comments: GoonBookComment[];
  createdAt: string;
  updatedAt: string;
}

export interface GoonBookAgentCredentialRecord {
  id: string;
  profileId: string;
  apiKeyHash: string;
  apiKeyPreview: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface AuthNonceRecord {
  nonce: string;
  wallet: string;
  message: string;
  expiresAt: string;
}

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartSnapshot {
  contractAddress: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  change5mPct: number;
  change1hPct: number;
  pairUrl: string;
  candles: ChartCandle[];
  source: "birdeye" | "dexscreener" | "synthetic";
}

export interface LiveCommand {
  speed: number;
  amplitude: number;
  minY: number;
  maxY: number;
  position?: number;
}

export interface SessionStartInput {
  wallet: string;
  contractAddress: string;
  deviceId: string;
  mode: SessionMode;
}

export interface FunscriptAction {
  at: number;
  pos: number;
}

export interface FunscriptPayload {
  version: string;
  inverted: boolean;
  range: number;
  actions: FunscriptAction[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  sourceKey?: string;
  category?: string;
  timeAgo?: string;
  tickers?: string[];
  sentiment?: string;
  relevance?: number;
}

export interface NewsFeed {
  mode: "category" | "search";
  category?: string;
  query?: string;
  fetchedAt: string;
  totalCount?: number;
  articles: NewsArticle[];
  sources: string[];
}

export interface ReferenceStatus {
  id: string;
  label: string;
  ready: boolean;
  note: string;
}

export interface AgentModelStatus {
  provider: string;
  model: string;
  projectId: string;
  location: string;
  usesVertexAi: boolean;
  configured: boolean;
}

export interface AgentOpsStatus {
  tokenMint: string;
  autoScanEnabled: boolean;
  reserveFloorSol: number;
  cnftIntervalMinutes: number;
  creatorFeeCnftSharePct: number;
  creatorFeeBuybackSharePct: number;
  invoiceVerificationReady: boolean;
  invoicePreviewId?: string;
  paymentCurrencyMint?: string;
  cnftCollectionConfigured: boolean;
  cnftTreeConfigured: boolean;
  cnftAuthorityConfigured: boolean;
  modelRuntime: AgentModelStatus;
  references: ReferenceStatus[];
}

export type AutonomousRuntimePhase =
  | "booting"
  | "awake"
  | "sleeping"
  | "paused"
  | "settling"
  | "liquidating"
  | "degraded";

export type AutonomousRevenueClass =
  | "creator_fee"
  | "goonclaw_chartsync"
  | "third_party_chartsync_commission";

export type AutonomousFeedEventKind =
  | "heartbeat"
  | "decision"
  | "policy"
  | "revenue"
  | "trade"
  | "burn"
  | "control"
  | "self_mod"
  | "replication"
  | "market"
  | "wallet"
  | "social"
  | "docs";

export type AutonomousControlAction =
  | "wake"
  | "pause"
  | "resume"
  | "force_settle"
  | "force_liquidate"
  | "approve_self_mod"
  | "reject_self_mod"
  | "trigger_replication"
  | "halt_replication";

export type AutonomousSettlementKind =
  | "owner_payout"
  | "buyback_burn"
  | "reserve_rebalance"
  | "treasury_trade"
  | "session_trade"
  | "position_liquidation";

export type AutonomousSettlementStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export type AutonomousDirectiveBucket = "tradingUsdc" | "sessionTradeUsdc";

export type AutonomousTradeDirectiveStatus =
  | "queued"
  | "executed"
  | "cancelled";

export interface AutonomousRevenuePolicy {
  revenueClass: AutonomousRevenueClass;
  ownerPct: number;
  burnPct: number;
  reservePct: number;
  tradingPct: number;
  sessionTradePct: number;
  notes: string;
}

export interface AutonomousRevenueBuckets {
  ownerUsdc: number;
  burnUsdc: number;
  reserveUsdc: number;
  tradingUsdc: number;
  sessionTradeUsdc: number;
  totalProcessedUsdc: number;
}

export interface AutonomousTradePosition {
  id: string;
  status: "open" | "closed";
  source: AutonomousRevenueClass | "reserve";
  marketMint: string;
  symbol: string;
  venue: "gmgn" | "pumpfun" | "pumpswap";
  entryUsdc: number;
  currentUsdc: number;
  rationale: string;
  openedAt: string;
  tokenAmountRaw?: string;
  entrySignature?: string | null;
  settlementId?: string | null;
  closedAt?: string;
  exitUsdc?: number;
  exitSignature?: string | null;
}

export interface AutonomousTradeDirective {
  id: string;
  bucket: AutonomousDirectiveBucket;
  revenueClass: AutonomousRevenueClass;
  marketMint: string;
  symbol: string;
  requestedUsdc: number;
  rationale: string;
  isPumpCoin: boolean;
  queuedAt: string;
  queuedBy: "owner" | "runtime";
  status: AutonomousTradeDirectiveStatus;
  positionId?: string | null;
  lastOutcome?: string | null;
}

export interface AutonomousSettlementRecord {
  id: string;
  kind: AutonomousSettlementKind;
  status: AutonomousSettlementStatus;
  amountUsdc: number;
  bucket?: AutonomousDirectiveBucket | "ownerUsdc" | "burnUsdc" | "reserveUsdc" | null;
  revenueClass?: AutonomousRevenueClass | null;
  requestedAt: string;
  updatedAt: string;
  attempts: number;
  destinationAddress?: string | null;
  marketMint?: string | null;
  symbol?: string | null;
  directiveId?: string | null;
  positionId?: string | null;
  txSignatures: string[];
  lastError?: string | null;
  lastOutcome?: string | null;
}

export interface AutonomousReplicaChild {
  id: string;
  label: string;
  createdAt: string;
  heartbeatAt: string;
  runtimePhase: AutonomousRuntimePhase;
  constitutionPath: string;
  constitutionHash: string;
  parentAgentId: string;
  scope: string;
  lastOutcome?: string | null;
}

export interface AutonomousRuntimeTuning {
  preferredSessionTradeMint?: string | null;
  preferredSessionTradeSymbol?: string | null;
  preferredTreasuryTradeMint?: string | null;
  preferredTreasuryTradeSymbol?: string | null;
  replicationTemplateLabel?: string | null;
}

export interface AutonomousSelfModificationProposal {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  proposedBy: "owner" | "runtime";
  tuningPatch: AutonomousRuntimeTuning;
  status: "pending" | "approved" | "applied" | "rejected";
  contentHash: string;
  reviewNote?: string | null;
}

export interface AutonomousFeedEvent {
  id: string;
  createdAt: string;
  kind: AutonomousFeedEventKind;
  title: string;
  detail: string;
  rawTrace: string[];
}

export interface AutonomousTransferGuardrails {
  arbitraryTransfersBlocked: boolean;
  allowedDestinations: string[];
  blockedDestinationClasses: string[];
  conwayPaymentsAllowed: boolean;
  conwayAllowedHosts: string[];
  notes: string;
}

export interface AutonomousTradeGuardrails {
  pumpOnlyTrading: boolean;
  maxPortfolioAllocationPct: number;
  allowedTradingVenues: string[];
  blockedTradingVenues: string[];
  notes: string;
}

export interface AutonomousToolingStatus {
  vertexOnly: boolean;
  solanaAgentKitConfigured: boolean;
  solanaMcpConfigured: boolean;
  conwayCodexMcpConfigured: boolean;
  conwayApiKeyConfigured: boolean;
  tavilyMcpConfigured: boolean;
  tavilyApiKeyConfigured: boolean;
  context7McpConfigured: boolean;
  taskMasterMcpConfigured: boolean;
  excelMcpConfigured: boolean;
  dexterX402Installed: boolean;
  dexterX402Version: string | null;
  gmgnConfigured: boolean;
  gmgnSigningReady: boolean;
  gmgnTradingWallet: string | null;
  telegramBroadcastEnabled: boolean;
  telegramChatConfigured: boolean;
  agentWalletAddress: string | null;
  loadedSkillCount: number;
  loadedActionCount: number;
  availableActions: string[];
  blockedActionNames: string[];
  configuredMcpServerNames: string[];
  vendoredSkillNames: string[];
  codexSkillNames: string[];
}

export interface AutonomousControlState {
  paused: boolean;
  pauseReason: string | null;
  lastAction: AutonomousControlAction | null;
  lastActionAt: string | null;
  circuitBreakerState?: CircuitBreakerState;
}

export interface AutonomousTreasuryStatus {
  treasuryWallet: string;
  ownerWallet: string;
  reserveFloorSol: number;
  reserveHealthy: boolean;
  reserveSol: number;
  usdcBalance: number;
  goonclawTokenMint: string;
  transferGuardrails: AutonomousTransferGuardrails;
  tradeGuardrails: AutonomousTradeGuardrails;
}

export interface AutonomousReplicationStatus {
  enabled: boolean;
  childCount: number;
  lastEventAt: string | null;
  lastOutcome?: string | null;
  children: AutonomousReplicaChild[];
}

export interface AutonomousSelfModificationStatus {
  enabled: boolean;
  lastEventAt: string | null;
  auditProtected: boolean;
  currentTuning: AutonomousRuntimeTuning;
  pendingProposal?: string | null;
  pendingProposalId?: string | null;
  proposals: AutonomousSelfModificationProposal[];
  lastOutcome?: string | null;
}

export interface AutonomousTapeItem {
  id: string;
  source: "market" | "wallet" | "x" | "docs" | "goonbook";
  label: string;
  detail: string;
  href?: string | null;
}

export interface AutonomousWalletAnalytics {
  wallet: string;
  label: string;
  source: "smart_money" | "kol" | "payer";
  styleClassification: string;
  walletPersonality?: string | null;
  walletSecondaryPersonality?: string | null;
  walletModifiers: string[];
  memorableMoments: string[];
  narrativeSummary: string;
  walletMemo: string;
  pumpTokensTraded?: number;
  solSpent?: number;
  solReceived?: number;
  estimatedPnlSol?: number;
  winRatePct?: number;
  pnl7d?: number;
  pnl30d?: number;
}

export interface AutonomousSmartWallet {
  wallet: string;
  label: string;
  source: "smart_money" | "kol";
  score: number;
  winRatePct: number;
  pnl7d: number;
  pnl30d: number;
  holdings: string[];
  notableMints: string[];
  socialHandle?: string | null;
  socialUrl?: string | null;
  walletMemo: string;
  narrativeSummary: string;
}

export interface AutonomousDomainDoc {
  domain: string;
  source: "llms.txt" | "llms-full.txt" | "install.md";
  summary: string;
  fetchedAt: string;
  url: string;
}

export interface AutonomousMarketIntelStatus {
  updatedAt: string | null;
  heartbeatSource: string;
  summary: string;
  topTape: AutonomousTapeItem[];
  tradeCards: MarketTradeCard[];
  trackedWallets: AutonomousSmartWallet[];
  walletAnalytics: AutonomousWalletAnalytics[];
  docs: AutonomousDomainDoc[];
  nextTradeCandidateMint?: string | null;
  nextTradeCandidateSymbol?: string | null;
  lastPostedTradeCardKey?: string | null;
  lastPostedAt?: string | null;
  lastOutcome?: string | null;
}

export interface AutonomousAgentStatus {
  agentId: string;
  name: string;
  purpose: string;
  constitutionPath: string;
  constitutionHash: string;
  runtimePhase: AutonomousRuntimePhase;
  heartbeatAt: string;
  wakeReason: string;
  latestPolicyDecision: string;
  publicTraceMode: string;
  modelRuntime: AgentModelStatus;
  tooling: AutonomousToolingStatus;
  control: AutonomousControlState;
  treasury: AutonomousTreasuryStatus;
  revenuePolicies: AutonomousRevenuePolicy[];
  revenueBuckets: AutonomousRevenueBuckets;
  positions: AutonomousTradePosition[];
  tradeDirectives: AutonomousTradeDirective[];
  settlements: AutonomousSettlementRecord[];
  goals: string[];
  replication: AutonomousReplicationStatus;
  selfModification: AutonomousSelfModificationStatus;
  marketIntel: AutonomousMarketIntelStatus;
  recentFeed: AutonomousFeedEvent[];
  feedSize: number;
  circuitBreakerState?: CircuitBreakerState;
}

export interface AutonomousRuntimeSummary {
  heartbeatAt: string;
  runtimePhase: AutonomousRuntimePhase;
  latestPolicyDecision: string;
  paused: boolean;
  pauseReason: string | null;
  lastAction: AutonomousControlAction | null;
  lastActionAt: string | null;
  reserveHealthy: boolean;
  reserveSol: number;
  reserveFloorSol: number;
  pendingSelfModification: string | null;
  replicationEnabled: boolean;
  replicationChildCount: number;
  queuedTradeDirectives: number;
  queuedSettlements: number;
}

export interface LaunchonomicsWindowSet {
  first10MinutesEndsAt: string;
  firstHourEndsAt: string;
  first12HoursEndsAt: string;
  first24HoursEndsAt: string;
}

export interface LaunchonomicsEvaluation {
  wallet: string;
  tokenMint: string;
  tokenSymbol: string;
  launchAt: string;
  firstTradeAt?: string;
  tier: LaunchonomicsTier;
  badge: LaunchonomicsBadge;
  qualifyingTradeCount: number;
  tradedWithin24Hours: boolean;
  heldThrough24Hours: boolean;
  currentBalance?: number;
  currentBalanceSymbol?: string;
  summary: string;
  subscriptionEndsAt?: string;
  windows: LaunchonomicsWindowSet;
}
