export type ComputeResourceClass =
  | "cpu_second"
  | "gpu_second"
  | "model_token_1k"
  | "storage_gb_hour"
  | "preservation_write";

export type ComputeCapabilityKind =
  | "compute"
  | "prompt_processing"
  | "model_execution"
  | "storage"
  | "preservation"
  | "task_execution"
  | "domain_vendor"
  | "gistbook_memory"
  | "cancer_research"
  | "cancer_prediction_sim";

export type PaymentAdapterKind =
  | "x402"
  | "manual_invoice"
  | "solana_memo"
  | "btc_watcher"
  | "xmr_watcher"
  | "conway";

export type RewardClass = "simulated" | "in_game" | "settled";

export type RewardEntryKind =
  | "token_holder_proportional"
  | "proof_of_compute"
  | "proof_of_loss"
  | "participation"
  | "service_sale"
  | "in_game";

export type MarketActorKind = "human" | "agent" | "node" | "runtime";
export type PrincipalKind = "human" | "agent";
export type PeerTransport = "local" | "relay" | "hybrid";
export type ComputeOfferStatus = "open" | "paused" | "filled" | "cancelled";
export type ComputeRequestStatus =
  | "open"
  | "matched"
  | "assigned"
  | "completed"
  | "cancelled";
export type ComputeBidStatus = "open" | "accepted" | "rejected" | "cancelled";
export type ComputeAssignmentStatus =
  | "assigned"
  | "running"
  | "completed"
  | "cancelled"
  | "disputed";
export type VendorOfferKind =
  | "domain"
  | "compute"
  | "storage"
  | "preservation"
  | "custom";
export type VendorOfferStatus = "open" | "paused" | "filled" | "cancelled";
export type VendorIntentStatus =
  | "open"
  | "assigned"
  | "completed"
  | "cancelled";
export type SettlementStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "settled"
  | "failed";
export type SettlementMode = "simulation" | "invoice" | "watcher" | "x402";
export type PerpPositionSide = "long" | "short";
export type ForecastSelection = "yes" | "no";

export interface PrincipalLink {
  id: string;
  kind: PrincipalKind;
  label: string;
}

export interface PrincipalChain {
  links: PrincipalLink[];
  terminalHumanId: string;
}

export interface EvidenceDigestRef {
  id: string;
  digest: string;
  algorithm: "sha256";
  source: string;
  createdAt: string;
}

export interface MarketActor {
  id: string;
  kind: MarketActorKind;
  label: string;
  nodeId?: string | null;
  principalChain: PrincipalChain;
  capabilities: ComputeCapabilityKind[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityAd {
  id: string;
  peerId: string;
  actorId: string;
  capability: ComputeCapabilityKind;
  resourceClass?: ComputeResourceClass | null;
  region: string;
  tier: string;
  reliabilityScore: number;
  latencyMs: number;
  settlementAdapters: PaymentAdapterKind[];
  priceHint?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PeerRecord {
  id: string;
  label: string;
  transport: PeerTransport;
  relayFallback: boolean;
  relayPeerId?: string | null;
  reputationScore: number;
  capabilityAds: CapabilityAd[];
  evidenceDigests: EvidenceDigestRef[];
  createdAt: string;
  updatedAt: string;
}

export interface RewardPoolPolicy {
  totalRewardsPoolPct: number;
  tokenHolderProportionalPct: number;
  proofOfComputePct: number;
  userRewardPct: number;
}

export interface CommunityConfig {
  id: string;
  label: string;
  bootstrapMintAddresses: string[];
  localFirst: boolean;
  relayFallbackEnabled: boolean;
  walletConnectRequired: boolean;
  paymentAdapters: PaymentAdapterKind[];
  rewardPoolPolicy: RewardPoolPolicy;
  savegameRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PeerRegistryState {
  id: string;
  peers: PeerRecord[];
  updatedAt: string;
}

export interface SubagentRegistryState {
  id: string;
  actors: MarketActor[];
  updatedAt: string;
}

export interface RewardEntry {
  id: string;
  actorId: string;
  kind: RewardEntryKind;
  rewardClass: RewardClass;
  amount: number;
  referenceId?: string | null;
  reason: string;
  createdAt: string;
}

export interface RewardLedgerState {
  id: string;
  policy: RewardPoolPolicy;
  entries: RewardEntry[];
  updatedAt: string;
}

export interface ComputeOffer {
  id: string;
  actorId: string;
  peerId: string;
  title: string;
  resourceClass: ComputeResourceClass;
  capability: ComputeCapabilityKind;
  region: string;
  tier: string;
  availableUnits: number;
  minUnits: number;
  maxUnits: number;
  unitPrice: number;
  priceCurrency: string;
  reliabilityScore: number;
  latencyMs: number;
  settlementAdapters: PaymentAdapterKind[];
  rewardClass: RewardClass;
  status: ComputeOfferStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ComputeRequest {
  id: string;
  actorId: string;
  peerId: string;
  title: string;
  resourceClass: ComputeResourceClass;
  capability: ComputeCapabilityKind;
  region: string;
  tier: string;
  requestedUnits: number;
  maxUnitPrice?: number | null;
  minReliabilityScore: number;
  maxLatencyMs: number;
  settlementAdapters: PaymentAdapterKind[];
  rewardClass: RewardClass;
  status: ComputeRequestStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ComputeBid {
  id: string;
  requestId: string;
  offerId: string;
  actorId: string;
  proposedUnits: number;
  unitPrice: number;
  reliabilityScore: number;
  latencyMs: number;
  settlementAdapter: PaymentAdapterKind;
  status: ComputeBidStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementIntent {
  id: string;
  adapter: PaymentAdapterKind;
  payerActorId: string;
  payeeActorId: string;
  amount: number;
  currency: string;
  mode: SettlementMode;
  correlationId: string;
  memo?: string | null;
  invoiceId?: string | null;
  createdAt: string;
  status: SettlementStatus;
}

export interface SettlementReceipt {
  id: string;
  adapter: PaymentAdapterKind;
  correlationId: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  confirmedAt?: string | null;
  txRef?: string | null;
  note?: string | null;
}

export interface ComputeAssignment {
  id: string;
  requestId: string;
  offerId: string;
  bidId: string;
  buyerActorId: string;
  sellerActorId: string;
  resourceClass: ComputeResourceClass;
  capability: ComputeCapabilityKind;
  region: string;
  tier: string;
  agreedUnits: number;
  agreedUnitPrice: number;
  settlementIntent?: SettlementIntent | null;
  status: ComputeAssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ComputeCompletion {
  id: string;
  assignmentId: string;
  deliveredUnits: number;
  totalPrice: number;
  priceCurrency: string;
  evidenceDigest?: EvidenceDigestRef | null;
  settlementReceipt?: SettlementReceipt | null;
  buyerRating?: number | null;
  sellerRating?: number | null;
  notes?: string | null;
  completedAt: string;
}

export interface ComputeMarketState {
  id: string;
  offers: ComputeOffer[];
  requests: ComputeRequest[];
  bids: ComputeBid[];
  assignments: ComputeAssignment[];
  completions: ComputeCompletion[];
  updatedAt: string;
}

export interface ComputeIndexBar {
  id: string;
  resourceClass: ComputeResourceClass;
  region: string;
  tier: string;
  openedAt: string;
  closedAt: string;
  spotIndex: number;
  vwapPrice: number;
  executableBookPrice: number;
  volumeUnits: number;
  sourceCount: number;
}

export interface ComputePerpContract {
  id: string;
  resourceClass: ComputeResourceClass;
  region: string;
  tier: string;
  settlementCurrency: string;
  markPrice: number;
  lastPrice: number;
  status: "open" | "settled";
  epochStartAt: string;
  epochEndAt: string;
  source: string;
  updatedAt: string;
}

export interface ComputePerpPosition {
  id: string;
  contractId: string;
  actorId: string;
  side: PerpPositionSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  margin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface ComputeForecastQuestion {
  id: string;
  resourceClass: ComputeResourceClass;
  region: string;
  tier: string;
  prompt: string;
  thresholdPrice: number;
  closesAt: string;
  resolvesAt: string;
  status: "open" | "resolved";
  resolution?: ForecastSelection | "invalid" | null;
  updatedAt: string;
}

export interface ComputeForecastPosition {
  id: string;
  questionId: string;
  actorId: string;
  selection: ForecastSelection;
  stake: number;
  impliedProbability: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceComputePrice {
  id: string;
  resourceClass: ComputeResourceClass;
  region: string;
  tier: string;
  spotIndex: number;
  perpMark?: number | null;
  forecastPrice?: number | null;
  referencePrice: number;
  liquidityMode: "spot_only" | "spot_perp" | "spot_forecast" | "full_blend";
  updatedAt: string;
}

export interface ComputePriceMarketState {
  id: string;
  indexBars: ComputeIndexBar[];
  perpContracts: ComputePerpContract[];
  perpPositions: ComputePerpPosition[];
  forecastQuestions: ComputeForecastQuestion[];
  forecastPositions: ComputeForecastPosition[];
  referencePrices: ReferenceComputePrice[];
  updatedAt: string;
}

export interface VendorOffer {
  id: string;
  actorId: string;
  peerId: string;
  kind: VendorOfferKind;
  title: string;
  description: string;
  region: string;
  tier: string;
  unitPrice: number;
  priceCurrency: string;
  settlementAdapters: PaymentAdapterKind[];
  status: VendorOfferStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DomainOffer {
  id: string;
  vendorOfferId: string;
  actorId: string;
  peerId: string;
  label: string;
  brand: string;
  tld: string;
  searchTerm: string;
  reservationWindowMinutes: number;
  unitPrice: number;
  priceCurrency: string;
  settlementAdapters: PaymentAdapterKind[];
  status: VendorOfferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationIntent {
  id: string;
  actorId: string;
  vendorOfferId: string;
  domainOfferId?: string | null;
  requestLabel: string;
  requestedAt: string;
  status: VendorIntentStatus;
}

export interface VendorAssignment {
  id: string;
  reservationIntentId: string;
  vendorOfferId: string;
  actorId: string;
  buyerActorId: string;
  agreedPrice: number;
  priceCurrency: string;
  settlementIntent?: SettlementIntent | null;
  status: VendorIntentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VendorCompletion {
  id: string;
  assignmentId: string;
  deliveryRef?: string | null;
  settlementReceipt?: SettlementReceipt | null;
  completedAt: string;
}

export interface VendorMarketState {
  id: string;
  offers: VendorOffer[];
  domainOffers: DomainOffer[];
  intents: ReservationIntent[];
  assignments: VendorAssignment[];
  completions: VendorCompletion[];
  updatedAt: string;
}

export interface CanonicalMeshState {
  community: CommunityConfig;
  peers: PeerRegistryState;
  subagents: SubagentRegistryState;
  rewards: RewardLedgerState;
  computeMarket: ComputeMarketState;
  computePriceMarkets: ComputePriceMarketState;
  vendorMarket: VendorMarketState;
}

export interface SavegameBundle {
  version: "tianezha-savegame/v1";
  exportedAt: string;
  state: CanonicalMeshState;
}

export interface PaymentAdapter {
  kind: PaymentAdapterKind;
  label: string;
  optional: boolean;
  enabled: boolean;
  quote: (intent: SettlementIntent) => SettlementIntent;
  createSettlement: (intent: SettlementIntent) => Promise<SettlementReceipt>;
  reconcile: (receipt: SettlementReceipt) => Promise<SettlementReceipt>;
  confirm: (receipt: SettlementReceipt) => Promise<SettlementReceipt>;
  serializeReceipt: (receipt: SettlementReceipt) => string;
}
