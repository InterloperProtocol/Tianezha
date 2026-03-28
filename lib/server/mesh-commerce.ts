import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { getServerEnv } from "@/lib/env";
import { getTianezhaChainMcpServerNames } from "@/lib/server/tianshi-tooling-catalog";
import { RA_AGENT_SEEDS } from "@/lib/simulation/constants";
import { x402PaymentAdapter } from "@/packages/adapters/src/payments/x402";
import { manualInvoicePaymentAdapter } from "@/packages/adapters/src/payments/manualInvoice";
import { solanaMemoPaymentAdapter } from "@/packages/adapters/src/payments/solanaMemo";
import { btcWatcherPaymentAdapter } from "@/packages/adapters/src/payments/btcWatcher";
import { xmrWatcherPaymentAdapter } from "@/packages/adapters/src/payments/xmrWatcher";
import { conwayPaymentAdapter } from "@/packages/adapters/src/payments/conway";
import { buildGistbookCapabilityAd } from "@/packages/adapters/src/gistbook";
import { buildCancerHawkCapabilityAd } from "@/packages/adapters/src/cancerhawk";
import { buildCancerPredictionCapabilityAd } from "@/packages/adapters/src/cancerMarkets";
import { bootstrapCommunityFromMintAddresses } from "@/packages/core/src/community";
import {
  assignBestComputeOffer,
  completeComputeAssignment,
  createComputeMarketState,
  upsertComputeOffer,
  upsertComputeRequest,
} from "@/packages/core/src/computeMarket";
import {
  createComputePriceMarketState,
  placeForecastPosition,
  syncReferencePrice,
  upsertComputeForecastQuestion,
  upsertComputePerpContract,
  upsertComputePerpPosition,
} from "@/packages/core/src/computePriceMarkets";
import { createPeerRegistryState, upsertPeerRecord } from "@/packages/core/src/peer";
import {
  createRewardLedgerState,
  recordProofOfComputeReward,
  summarizeRewardsByKind,
} from "@/packages/core/src/rewards";
import {
  createSavegameBundle,
  parseSavegameBundle,
  restoreSavegameBundle,
  stringifySavegameBundle,
} from "@/packages/core/src/savegame";
import {
  createRaSubagentActor,
  createSubagentRegistryState,
  createTianshiRuntimeActor,
} from "@/packages/core/src/subagents";
import { createVendorMarketState } from "@/packages/core/src/vendorMarket";
import type {
  CanonicalMeshState,
  CommunityConfig,
  ComputeMarketState,
  ComputePriceMarketState,
  DomainOffer,
  PaymentAdapter,
  PeerRecord,
  PeerRegistryState,
  RewardLedgerState,
  SubagentRegistryState,
  VendorOffer,
  VendorMarketState,
} from "@/packages/core/src/protocol";

const STATE_FILE = path.join(process.cwd(), ".data", "mesh-commerce-state.json");

function nowIso() {
  return new Date().toISOString();
}

function ensureDataDir() {
  const targetDir = path.dirname(STATE_FILE);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeActorMcpBindings(state: CanonicalMeshState) {
  const requiredMcpServerNames = getTianezhaChainMcpServerNames();
  let changed = false;

  const actors = state.subagents.actors.map((actor) => {
    const existingNames = Array.isArray(actor.metadata?.mcpServerNames)
      ? actor.metadata.mcpServerNames.filter(
          (serverName): serverName is string => typeof serverName === "string",
        )
      : [];
    const nextNames = Array.from(
      new Set([...existingNames, ...requiredMcpServerNames]),
    );

    if (
      nextNames.length === existingNames.length &&
      nextNames.every((serverName, index) => serverName === existingNames[index])
    ) {
      return actor;
    }

    changed = true;
    return {
      ...actor,
      metadata: {
        ...(actor.metadata || {}),
        mcpServerNames: nextNames,
      },
    };
  });

  if (!changed) {
    return {
      changed,
      state,
    };
  }

  return {
    changed,
    state: {
      ...state,
      subagents: {
        ...state.subagents,
        actors,
        updatedAt: nowIso(),
      },
    },
  };
}

function getPaymentAdapters(): PaymentAdapter[] {
  return [
    x402PaymentAdapter,
    manualInvoicePaymentAdapter,
    solanaMemoPaymentAdapter,
    btcWatcherPaymentAdapter,
    xmrWatcherPaymentAdapter,
    conwayPaymentAdapter,
  ];
}

function buildCommunity(): CommunityConfig {
  const env = getServerEnv();
  const bootstrapMintAddresses = [
    env.BAGSTROKE_TOKEN_MINT,
    process.env.TIANEZHA_BNB_TOKEN_ADDRESS || "",
  ].filter(Boolean);

  return bootstrapCommunityFromMintAddresses(bootstrapMintAddresses, {
    id: "community:tianezha",
    label: "Tianezha Native Mesh",
    paymentAdapters: getPaymentAdapters()
      .filter((adapter) => adapter.enabled || !adapter.optional)
      .map((adapter) => adapter.kind),
  });
}

function buildSubagents(): SubagentRegistryState {
  const env = getServerEnv();
  const humanPrincipalId = env.TIANSHI_OWNER_WALLET || "human:tianezha-operator";
  const humanPrincipalLabel = "Tianezha operator";
  const mcpServerNames = getTianezhaChainMcpServerNames();
  const tianshi = createTianshiRuntimeActor({
    humanPrincipalId,
    humanPrincipalLabel,
    mcpServerNames,
  });

  const raActors = RA_AGENT_SEEDS.slice(0, 4).map((seed, index) =>
    createRaSubagentActor({
      actorId: `actor:ra:${index + 1}`,
      capabilities:
        index % 2 === 0
          ? ["compute", "prompt_processing", "task_execution"]
          : ["storage", "preservation", "domain_vendor"],
      humanPrincipalId,
      humanPrincipalLabel,
      label: `RA ${seed.replace(/\..+$/, "").toUpperCase()}`,
      mcpServerNames,
      nodeId: `peer:ra:${index + 1}`,
    }),
  );

  return createSubagentRegistryState([tianshi, ...raActors]);
}

function buildPeers(subagents: SubagentRegistryState): PeerRegistryState {
  const gistbookEnabled = process.env.TIANEZHA_DISABLE_GISTBOOK !== "1";
  const cancerhawkEnabled = process.env.TIANEZHA_ENABLE_CANCERHAWK === "1";
  const cancerPredictionEnabled =
    process.env.TIANEZHA_ENABLE_CANCER_PREDICTION === "1";
  let state = createPeerRegistryState();
  const timestamp = nowIso();

  const localPeer: PeerRecord = {
    capabilityAds: [
      {
        actorId: "actor:tianshi",
        capability: "compute" as const,
        createdAt: timestamp,
        id: "cap:tianshi:compute",
        latencyMs: 18,
        peerId: "peer:tianshi-local",
        priceHint: 0.85,
        region: "local",
        reliabilityScore: 0.995,
        resourceClass: "gpu_second" as const,
        settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
        tier: "core",
        updatedAt: timestamp,
      },
      {
        actorId: "actor:tianshi",
        capability: "model_execution" as const,
        createdAt: timestamp,
        id: "cap:tianshi:model",
        latencyMs: 32,
        peerId: "peer:tianshi-local",
        priceHint: 0.22,
        region: "local",
        reliabilityScore: 0.99,
        resourceClass: "model_token_1k" as const,
        settlementAdapters: ["manual_invoice", "x402"],
        tier: "core",
        updatedAt: timestamp,
      },
      {
        actorId: "actor:tianshi",
        capability: "domain_vendor" as const,
        createdAt: timestamp,
        id: "cap:tianshi:domain",
        latencyMs: 80,
        peerId: "peer:tianshi-local",
        priceHint: 8.5,
        region: "global",
        reliabilityScore: 0.96,
        settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
        tier: "flagship",
        updatedAt: timestamp,
      },
      ...(gistbookEnabled
        ? [
            buildGistbookCapabilityAd({
              actorId: "actor:tianshi",
              id: "cap:tianshi:gistbook",
              peerId: "peer:tianshi-local",
            }),
          ]
        : []),
      ...(cancerhawkEnabled
        ? [
            buildCancerHawkCapabilityAd({
              actorId: "actor:tianshi",
              id: "cap:tianshi:cancerhawk",
              peerId: "peer:tianshi-local",
            }),
          ]
        : []),
      ...(cancerPredictionEnabled
        ? [
            buildCancerPredictionCapabilityAd({
              actorId: "actor:tianshi",
              id: "cap:tianshi:cancer-prediction",
              peerId: "peer:tianshi-local",
            }),
          ]
        : []),
    ],
    createdAt: timestamp,
    evidenceDigests: [
      {
        algorithm: "sha256" as const,
        createdAt: timestamp,
        digest: "mesh-local-evidence-digest",
        id: "digest:tianshi-local",
        source: "mesh-commerce-state",
      },
    ],
    id: "peer:tianshi-local",
    label: "Tianezha flagship",
    relayFallback: false,
    relayPeerId: "peer:relay:fallback",
    reputationScore: 0.99,
    transport: "hybrid" as const,
    updatedAt: timestamp,
  };

  const relayPeer: PeerRecord = {
    capabilityAds: [],
    createdAt: timestamp,
    evidenceDigests: [],
    id: "peer:relay:fallback",
    label: "Relay fallback",
    relayFallback: true,
    relayPeerId: null,
    reputationScore: 0.91,
    transport: "relay" as const,
    updatedAt: timestamp,
  };

  state = upsertPeerRecord(state, relayPeer);
  state = upsertPeerRecord(state, localPeer);

  subagents.actors
    .filter((actor) => actor.id !== "actor:tianshi")
    .forEach((actor, index) => {
      state = upsertPeerRecord(state, {
        capabilityAds: actor.capabilities.map((capability, capabilityIndex) => ({
          actorId: actor.id,
          capability,
          createdAt: timestamp,
          id: `cap:${actor.id}:${capabilityIndex}`,
          latencyMs: capability === "storage" ? 40 : 60,
          peerId: actor.nodeId || `peer:ra:${index + 1}`,
          priceHint: capability === "storage" ? 0.04 : 0.12,
          region: "mesh-east",
          reliabilityScore: capability === "storage" ? 0.97 : 0.94,
          resourceClass:
            capability === "storage"
              ? "storage_gb_hour"
              : capability === "preservation"
                ? "preservation_write"
                : "cpu_second",
          settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
          tier: index % 2 === 0 ? "community" : "edge",
          updatedAt: timestamp,
        })),
        createdAt: timestamp,
        evidenceDigests: [],
        id: actor.nodeId || `peer:ra:${index + 1}`,
        label: `${actor.label} node`,
        relayFallback: false,
        relayPeerId: "peer:relay:fallback",
        reputationScore: 0.9 - index * 0.02,
        transport: "hybrid",
        updatedAt: timestamp,
      });
    });

  return state;
}

function buildComputeMarket(subagents: SubagentRegistryState): ComputeMarketState {
  const timestamp = nowIso();
  let state = createComputeMarketState();
  const actors = Object.fromEntries(subagents.actors.map((actor) => [actor.id, actor]));
  const tianshi = actors["actor:tianshi"]!;
  const raActors = subagents.actors.filter((actor) => actor.id !== "actor:tianshi");

  state = upsertComputeOffer(state, {
    actorId: tianshi.id,
    availableUnits: 600,
    capability: "compute",
    createdAt: timestamp,
    id: "offer:tianshi:gpu",
    latencyMs: 18,
    maxUnits: 600,
    metadata: { label: "Flagship GPU lane" },
    minUnits: 25,
    peerId: tianshi.nodeId || "peer:tianshi-local",
    priceCurrency: "USD",
    region: "local",
    reliabilityScore: 0.995,
    resourceClass: "gpu_second",
    rewardClass: "simulated",
    settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
    status: "open",
    tier: "core",
    title: "Flagship GPU execution",
    unitPrice: 0.85,
    updatedAt: timestamp,
  });
  state = upsertComputeOffer(state, {
    actorId: tianshi.id,
    availableUnits: 1800,
    capability: "model_execution",
    createdAt: timestamp,
    id: "offer:tianshi:model",
    latencyMs: 32,
    maxUnits: 1800,
    metadata: { label: "Prompt routing lane" },
    minUnits: 200,
    peerId: tianshi.nodeId || "peer:tianshi-local",
    priceCurrency: "USD",
    region: "local",
    reliabilityScore: 0.99,
    resourceClass: "model_token_1k",
    rewardClass: "simulated",
    settlementAdapters: ["manual_invoice", "x402"],
    status: "open",
    tier: "core",
    title: "Flagship model execution",
    unitPrice: 0.22,
    updatedAt: timestamp,
  });

  raActors.forEach((actor, index) => {
    const storageActor = index % 2 === 1;
    state = upsertComputeOffer(state, {
      actorId: actor.id,
      availableUnits: storageActor ? 2800 : 2400,
      capability: storageActor ? "storage" : "prompt_processing",
      createdAt: timestamp,
      id: `offer:${actor.id}`,
      latencyMs: storageActor ? 42 : 55,
      maxUnits: storageActor ? 2800 : 2400,
      minUnits: storageActor ? 100 : 50,
      peerId: actor.nodeId || `peer:ra:${index + 1}`,
      priceCurrency: "USD",
      region: "mesh-east",
      reliabilityScore: storageActor ? 0.97 : 0.94,
      resourceClass: storageActor ? "storage_gb_hour" : "cpu_second",
      rewardClass: "simulated",
      settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
      status: "open",
      tier: storageActor ? "community" : "edge",
      title: storageActor ? `${actor.label} storage lane` : `${actor.label} prompt lane`,
      unitPrice: storageActor ? 0.04 : 0.12 + index * 0.01,
      updatedAt: timestamp,
    });
  });

  state = upsertComputeRequest(state, {
    actorId: "actor:ra:1",
    capability: "compute",
    createdAt: timestamp,
    id: "request:ra:1:gpu",
    maxLatencyMs: 30,
    maxUnitPrice: 0.9,
    metadata: { label: "RA subagent upscale run" },
    minReliabilityScore: 0.98,
    peerId: "peer:ra:1",
    priceCurrency: "USD",
    region: "local",
    requestedUnits: 120,
    resourceClass: "gpu_second",
    rewardClass: "simulated",
    settlementAdapters: ["manual_invoice", "x402"],
    status: "open",
    tier: "core",
    title: "RA upscale GPU request",
    updatedAt: timestamp,
  } as ComputeMarketState["requests"][number]);
  state = upsertComputeRequest(state, {
    actorId: "actor:tianshi",
    capability: "storage",
    createdAt: timestamp,
    id: "request:tianshi:storage",
    maxLatencyMs: 60,
    maxUnitPrice: 0.05,
    metadata: { label: "Preserve evidence snapshots" },
    minReliabilityScore: 0.95,
    peerId: "peer:tianshi-local",
    priceCurrency: "USD",
    region: "mesh-east",
    requestedUnits: 300,
    resourceClass: "storage_gb_hour",
    rewardClass: "simulated",
    settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
    status: "open",
    tier: "community",
    title: "Evidence storage request",
    updatedAt: timestamp,
  } as ComputeMarketState["requests"][number]);

  state = assignBestComputeOffer({
    assignmentId: "assignment:ra:1:gpu",
    bidId: "bid:ra:1:gpu",
    requestId: "request:ra:1:gpu",
    settlementIntent: {
      adapter: "manual_invoice",
      amount: 102,
      correlationId: "assignment:ra:1:gpu",
      createdAt: timestamp,
      currency: "USD",
      id: "settlement:assignment:ra:1:gpu",
      mode: "invoice",
      payeeActorId: "actor:tianshi",
      payerActorId: "actor:ra:1",
      status: "pending",
    },
    state,
  });
  state = completeComputeAssignment({
    assignmentId: "assignment:ra:1:gpu",
    completionId: "completion:ra:1:gpu",
    deliveredUnits: 120,
    evidenceDigest: {
      algorithm: "sha256",
      createdAt: timestamp,
      digest: "assignment-ra-1-gpu",
      id: "digest:assignment:ra:1:gpu",
      source: "compute-market",
    },
    notes: "RA agent rented flagship GPU seconds for a bounded execution window.",
    state,
  });

  state = assignBestComputeOffer({
    assignmentId: "assignment:tianshi:storage",
    bidId: "bid:tianshi:storage",
    requestId: "request:tianshi:storage",
    settlementIntent: {
      adapter: "solana_memo",
      amount: 12,
      correlationId: "assignment:tianshi:storage",
      createdAt: timestamp,
      currency: "USD",
      id: "settlement:assignment:tianshi:storage",
      memo: "tianshi-storage-proof",
      mode: "watcher",
      payeeActorId: "actor:ra:2",
      payerActorId: "actor:tianshi",
      status: "pending",
    },
    state,
  });
  state = completeComputeAssignment({
    assignmentId: "assignment:tianshi:storage",
    completionId: "completion:tianshi:storage",
    deliveredUnits: 300,
    evidenceDigest: {
      algorithm: "sha256",
      createdAt: timestamp,
      digest: "assignment-tianshi-storage",
      id: "digest:assignment:tianshi:storage",
      source: "compute-market",
    },
    notes: "Storage lane preserved snapshot evidence for a savegame checkpoint.",
    state,
  });

  return state;
}

function buildComputePriceMarkets(
  computeMarket: ComputeMarketState,
): ComputePriceMarketState {
  const timestamp = nowIso();
  let state = createComputePriceMarketState();

  state = upsertComputePerpContract(state, {
    epochEndAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    epochStartAt: timestamp,
    id: "perp:gpu_second:local:core",
    lastPrice: 0.84,
    markPrice: 0.87,
    region: "local",
    resourceClass: "gpu_second",
    settlementCurrency: "USD",
    source: "nezha-compute",
    status: "open",
    tier: "core",
    updatedAt: timestamp,
  });
  state = upsertComputePerpPosition(state, {
    actorId: "actor:ra:1",
    contractId: "perp:gpu_second:local:core",
    createdAt: timestamp,
    entryPrice: 0.82,
    id: "perp-position:ra:1:gpu",
    margin: 24,
    markPrice: 0.87,
    realizedPnl: 0,
    side: "long",
    size: 120,
    status: "open",
    unrealizedPnl: 6,
    updatedAt: timestamp,
  });
  state = upsertComputePerpContract(state, {
    epochEndAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    epochStartAt: timestamp,
    id: "perp:cpu_second:mesh-east:edge",
    lastPrice: 0.13,
    markPrice: 0.14,
    region: "mesh-east",
    resourceClass: "cpu_second",
    settlementCurrency: "USD",
    source: "nezha-compute",
    status: "open",
    tier: "edge",
    updatedAt: timestamp,
  });
  state = upsertComputePerpPosition(state, {
    actorId: "actor:tianshi",
    contractId: "perp:cpu_second:mesh-east:edge",
    createdAt: timestamp,
    entryPrice: 0.125,
    id: "perp-position:tianshi:cpu",
    margin: 18,
    markPrice: 0.14,
    realizedPnl: 0,
    side: "short",
    size: 200,
    status: "open",
    unrealizedPnl: -3,
    updatedAt: timestamp,
  });

  state = upsertComputeForecastQuestion(state, {
    closesAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    id: "forecast:gpu-second-threshold",
    prompt: "Will local flagship GPU seconds clear above $0.90 this epoch?",
    region: "local",
    resolvesAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    resourceClass: "gpu_second",
    status: "open",
    thresholdPrice: 0.9,
    tier: "core",
    updatedAt: timestamp,
  });
  state = placeForecastPosition(state, {
    actorId: "actor:ra:1",
    createdAt: timestamp,
    id: "forecast-position:ra:1:gpu",
    impliedProbability: 0.62,
    questionId: "forecast:gpu-second-threshold",
    selection: "yes",
    stake: 48,
    updatedAt: timestamp,
  });
  state = placeForecastPosition(state, {
    actorId: "actor:tianshi",
    createdAt: timestamp,
    id: "forecast-position:tianshi:gpu",
    impliedProbability: 0.58,
    questionId: "forecast:gpu-second-threshold",
    selection: "yes",
    stake: 64,
    updatedAt: timestamp,
  });
  state = upsertComputeForecastQuestion(state, {
    closesAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    id: "forecast:cpu-second-threshold",
    prompt: "Will mesh-east CPU seconds clear above $0.15 this epoch?",
    region: "mesh-east",
    resolvesAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    resourceClass: "cpu_second",
    status: "open",
    thresholdPrice: 0.15,
    tier: "edge",
    updatedAt: timestamp,
  });
  state = placeForecastPosition(state, {
    actorId: "actor:ra:3",
    createdAt: timestamp,
    id: "forecast-position:ra:3:cpu",
    impliedProbability: 0.54,
    questionId: "forecast:cpu-second-threshold",
    selection: "yes",
    stake: 28,
    updatedAt: timestamp,
  });
  state = placeForecastPosition(state, {
    actorId: "actor:tianshi",
    createdAt: timestamp,
    id: "forecast-position:tianshi:cpu",
    impliedProbability: 0.46,
    questionId: "forecast:cpu-second-threshold",
    selection: "no",
    stake: 36,
    updatedAt: timestamp,
  });

  state = syncReferencePrice(state, computeMarket, {
    region: "local",
    resourceClass: "gpu_second",
    tier: "core",
  });
  state = syncReferencePrice(state, computeMarket, {
    region: "mesh-east",
    resourceClass: "cpu_second",
    tier: "edge",
  });
  state = syncReferencePrice(state, computeMarket, {
    region: "local",
    resourceClass: "model_token_1k",
    tier: "core",
  });
  state = syncReferencePrice(state, computeMarket, {
    region: "mesh-east",
    resourceClass: "storage_gb_hour",
    tier: "community",
  });

  return state;
}

function buildVendorMarket(): VendorMarketState {
  const timestamp = nowIso();
  const state = createVendorMarketState();
  const flagshipOffer: VendorOffer = {
    actorId: "actor:tianshi",
    createdAt: timestamp,
    description:
      "Flagship domain vending for Tianezha branded and meme-domain flows.",
    id: "vendor:tianshi:domains",
    kind: "domain" as const,
    metadata: { brandedFlow: true },
    peerId: "peer:tianshi-local",
    priceCurrency: "USD",
    region: "global",
    settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
    status: "open" as const,
    tier: "flagship",
    title: "Flagship domain vendor",
    unitPrice: 8.5,
    updatedAt: timestamp,
  };
  const communityOffer: VendorOffer = {
    actorId: "actor:ra:2",
    createdAt: timestamp,
    description: "Community-run domain search and reservation vending.",
    id: "vendor:ra:2:domains",
    kind: "domain" as const,
    peerId: "peer:ra:2",
    priceCurrency: "USD",
    region: "global",
    settlementAdapters: ["manual_invoice", "x402"],
    status: "open" as const,
    tier: "community",
    title: "Community domain vendor",
    unitPrice: 5.25,
    updatedAt: timestamp,
  };

  return {
    ...state,
    domainOffers: [
      {
        actorId: "actor:tianshi",
        brand: "Tianezha flagship",
        createdAt: timestamp,
        id: "domain:tianshi:meme",
        label: "Flagship meme-domain lane",
        peerId: "peer:tianshi-local",
        priceCurrency: "USD",
        reservationWindowMinutes: 30,
        searchTerm: "tianezha",
        settlementAdapters: ["manual_invoice", "x402", "solana_memo"],
        status: "open",
        tld: ".mesh",
        unitPrice: 11.5,
        updatedAt: timestamp,
        vendorOfferId: flagshipOffer.id,
      },
      {
        actorId: "actor:ra:2",
        brand: "Community vendor",
        createdAt: timestamp,
        id: "domain:community:generic",
        label: "Community domain search",
        peerId: "peer:ra:2",
        priceCurrency: "USD",
        reservationWindowMinutes: 45,
        searchTerm: "community",
        settlementAdapters: ["manual_invoice", "x402"],
        status: "open",
        tld: ".io",
        unitPrice: 6.4,
        updatedAt: timestamp,
        vendorOfferId: communityOffer.id,
      },
    ] satisfies DomainOffer[],
    offers: [flagshipOffer, communityOffer],
    updatedAt: timestamp,
  };
}

function buildRewards(computeMarket: ComputeMarketState): RewardLedgerState {
  let ledger = createRewardLedgerState();
  computeMarket.completions.forEach((completion, index) => {
    const assignment = computeMarket.assignments.find(
      (entry) => entry.id === completion.assignmentId,
    );
    if (!assignment) {
      return;
    }

    ledger = recordProofOfComputeReward(ledger, {
      actorId: assignment.sellerActorId,
      amount: Number((completion.deliveredUnits * 0.21).toFixed(6)),
      id: `reward:proof-of-compute:${index + 1}`,
      reason: `Proof-of-compute credit for ${assignment.id}.`,
      referenceId: assignment.id,
    });
  });

  return ledger;
}

function buildCanonicalState(): CanonicalMeshState {
  const community = buildCommunity();
  const subagents = buildSubagents();
  const peers = buildPeers(subagents);
  const computeMarket = buildComputeMarket(subagents);
  const computePriceMarkets = buildComputePriceMarkets(computeMarket);
  const vendorMarket = buildVendorMarket();
  const rewards = buildRewards(computeMarket);

  return {
    community,
    computeMarket,
    computePriceMarkets,
    peers,
    rewards,
    subagents,
    vendorMarket,
  };
}

function writeState(state: CanonicalMeshState) {
  ensureDataDir();
  writeFileSync(STATE_FILE, stringifySavegameBundle(createSavegameBundle(state)), "utf8");
}

export function getMeshCommerceState(): CanonicalMeshState {
  ensureDataDir();
  if (!existsSync(STATE_FILE)) {
    const seeded = buildCanonicalState();
    writeState(seeded);
    return cloneState(seeded);
  }

  try {
    const parsed = parseSavegameBundle(readFileSync(STATE_FILE, "utf8"));
    const restored = restoreSavegameBundle(parsed);
    const normalized = normalizeActorMcpBindings(restored);
    if (normalized.changed) {
      writeState(normalized.state);
    }
    return cloneState(normalized.state);
  } catch {
    const rebuilt = buildCanonicalState();
    writeState(rebuilt);
    return cloneState(rebuilt);
  }
}

export function saveMeshCommerceState(state: CanonicalMeshState) {
  writeState(state);
  return cloneState(state);
}

export function resetMeshCommerceState() {
  const state = buildCanonicalState();
  writeState(state);
  return cloneState(state);
}

export function exportMeshCommerceSavegame() {
  return stringifySavegameBundle(createSavegameBundle(getMeshCommerceState()));
}

export function importMeshCommerceSavegame(serializedBundle: string) {
  const state = restoreSavegameBundle(parseSavegameBundle(serializedBundle));
  writeState(state);
  return cloneState(state);
}

export function getMeshCommerceSummary() {
  const state = getMeshCommerceState();
  const paymentAdapters = getPaymentAdapters();
  const rewardSummary = summarizeRewardsByKind(state.rewards);
  const chainMcpServerNames = getTianezhaChainMcpServerNames();
  const actorMcpBindings = state.subagents.actors.map((actor) => ({
    actorId: actor.id,
    mcpServerNames: Array.isArray(actor.metadata?.mcpServerNames)
      ? actor.metadata.mcpServerNames.filter(
          (serverName): serverName is string => typeof serverName === "string",
        )
      : [],
  }));

  return {
    adapters: {
      cancerPredictionEnabled:
        state.peers.peers.some((peer) =>
          peer.capabilityAds.some((ad) => ad.capability === "cancer_prediction_sim"),
        ),
      cancerhawkEnabled:
        state.peers.peers.some((peer) =>
          peer.capabilityAds.some((ad) => ad.capability === "cancer_research"),
        ),
      conwayEnabled: paymentAdapters.some(
        (adapter) => adapter.kind === "conway" && adapter.enabled,
      ),
      gistbookEnabled:
        state.peers.peers.some((peer) =>
          peer.capabilityAds.some((ad) => ad.capability === "gistbook_memory"),
        ),
    },
    compute: {
      activeAssignments: state.computeMarket.assignments.filter(
        (assignment) => assignment.status === "assigned" || assignment.status === "running",
      ).length,
      completedAssignments: state.computeMarket.completions.length,
      forecastQuestions: state.computePriceMarkets.forecastQuestions,
      openOffers: state.computeMarket.offers.filter((offer) => offer.status === "open").length,
      openRequests: state.computeMarket.requests.filter((request) => request.status === "open").length,
      perpContracts: state.computePriceMarkets.perpContracts,
      referencePrices: state.computePriceMarkets.referencePrices,
      rewardSummary,
      walletConnectRequired: state.community.walletConnectRequired,
    },
    paymentAdapters: paymentAdapters.map((adapter) => ({
      enabled: adapter.enabled,
      kind: adapter.kind,
      label: adapter.label,
      optional: adapter.optional,
    })),
    sentence:
      "Tianezha nodes natively buy and sell compute, services, storage, and preservation across the mesh. Payment rails are adapters. Conway is optional.",
    state,
    subagents: {
      actorCount: state.subagents.actors.length,
      actorMcpBindings,
      mcpServerNames: chainMcpServerNames,
      raActorIds: state.subagents.actors
        .filter((actor) => actor.id !== "actor:tianshi")
        .map((actor) => actor.id),
      tianshiActorId: "actor:tianshi",
    },
    vendors: {
      conwayRequired: false,
      domainOffers: state.vendorMarket.domainOffers,
      totalOffers: state.vendorMarket.offers.length,
    },
  };
}
