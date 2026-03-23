import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";

import { CONSTITUTION } from "@/lib/constitution";
import {
  AutonomousControlState,
  AutonomousFeedEvent,
  AutonomousMarketIntelStatus,
  AutonomousRevenueBuckets,
  AutonomousReplicationStatus,
  AutonomousSettlementRecord,
  AutonomousRuntimePhase,
  AutonomousSelfModificationStatus,
  AutonomousTradeDirective,
  AutonomousTradePosition,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { createClosedCircuitBreakerState } from "@/workers/security-guards";

type AutonomousAgentSnapshot = {
  heartbeatAt: string;
  runtimePhase: AutonomousRuntimePhase;
  wakeReason: string;
  latestPolicyDecision: string;
  control: AutonomousControlState;
  reserveSol: number;
  usdcBalance: number;
  revenueBuckets: AutonomousRevenueBuckets;
  positions: AutonomousTradePosition[];
  tradeDirectives: AutonomousTradeDirective[];
  settlements: AutonomousSettlementRecord[];
  replication: AutonomousReplicationStatus;
  selfModification: AutonomousSelfModificationStatus;
  marketIntel: AutonomousMarketIntelStatus;
};

type AutonomousStoreShape = {
  feed: AutonomousFeedEvent[];
  snapshot: AutonomousAgentSnapshot;
};

declare global {
  var __goonclawAutonomousStore: AutonomousStoreShape | undefined;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "goonclaw-autonomous-store.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createInitialSnapshot(): AutonomousAgentSnapshot {
  const timestamp = nowIso();
  const nowMs = new Date(timestamp).getTime();
  return {
    heartbeatAt: timestamp,
    runtimePhase: "booting",
    wakeReason: "initial boot",
    latestPolicyDecision:
      "Bootstrapping GoonClaw autonomous runtime under Vertex-only policy.",
    control: {
      paused: false,
      pauseReason: null,
      lastAction: null,
      lastActionAt: null,
      circuitBreakerState: createClosedCircuitBreakerState(nowMs),
    },
    reserveSol: Number(CONSTITUTION.reservePolicy.reserveFloorSol),
    usdcBalance: 0,
    revenueBuckets: {
      ownerUsdc: 0,
      burnUsdc: 0,
      reserveUsdc: 0,
      tradingUsdc: 0,
      sessionTradeUsdc: 0,
      totalProcessedUsdc: 0,
    },
    positions: [],
    tradeDirectives: [],
    settlements: [],
    replication: {
      enabled: true,
      childCount: 0,
      lastEventAt: null,
      lastOutcome: "Replication enabled under owner-audited policy.",
      children: [],
    },
    selfModification: {
      enabled: true,
      lastEventAt: null,
      auditProtected: true,
      currentTuning: {
        preferredSessionTradeMint: null,
        preferredSessionTradeSymbol: null,
        preferredTreasuryTradeMint: null,
        preferredTreasuryTradeSymbol: null,
        replicationTemplateLabel: null,
      },
      pendingProposal:
        "Optimize treasury settlement cadence without weakening reserve-floor protection.",
      pendingProposalId: null,
      proposals: [],
      lastOutcome: "Awaiting owner review for the next self-mod proposal.",
    },
    marketIntel: {
      updatedAt: null,
      heartbeatSource: "initial boot",
      summary: "Market intelligence has not completed a heartbeat refresh yet.",
      topTape: [],
      tradeCards: [],
      trackedWallets: [],
      walletAnalytics: [],
      docs: [],
      nextTradeCandidateMint: null,
      nextTradeCandidateSymbol: null,
      lastPostedTradeCardKey: null,
      lastPostedAt: null,
      lastOutcome: "Waiting for the first market heartbeat.",
    },
  };
}

function hydrateControlState(control?: Partial<AutonomousControlState> | null) {
  return {
    paused: control?.paused ?? false,
    pauseReason: control?.pauseReason ?? null,
    lastAction: control?.lastAction ?? null,
    lastActionAt: control?.lastActionAt ?? null,
    circuitBreakerState:
      control?.circuitBreakerState ||
      createClosedCircuitBreakerState(
        control?.lastActionAt ? new Date(control.lastActionAt).getTime() : Date.now(),
      ),
  } satisfies AutonomousControlState;
}

function hydrateSnapshot(snapshot?: Partial<AutonomousAgentSnapshot> | null) {
  const initialSnapshot = createInitialSnapshot();
  const mergedSnapshot = {
    ...initialSnapshot,
    ...snapshot,
  } as AutonomousAgentSnapshot;

  return {
    ...mergedSnapshot,
    control: hydrateControlState(snapshot?.control),
  } satisfies AutonomousAgentSnapshot;
}

function readStoreFromDisk(): AutonomousStoreShape {
  ensureDataDir();

  if (!existsSync(STORE_PATH)) {
    return {
      feed: [],
      snapshot: createInitialSnapshot(),
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<AutonomousStoreShape>;
    return {
      feed: Array.isArray(parsed.feed) ? parsed.feed : [],
      snapshot: hydrateSnapshot(parsed.snapshot),
    };
  } catch {
    return {
      feed: [],
      snapshot: createInitialSnapshot(),
    };
  }
}

function persistStore(store: AutonomousStoreShape) {
  ensureDataDir();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function getStore() {
  if (!global.__goonclawAutonomousStore) {
    global.__goonclawAutonomousStore = readStoreFromDisk();
  }

  return global.__goonclawAutonomousStore;
}

export function getAutonomousSnapshot() {
  return getStore().snapshot;
}

export function setAutonomousSnapshot(snapshot: AutonomousAgentSnapshot) {
  const store = getStore();
  store.snapshot = snapshot;
  persistStore(store);
}

export function listAutonomousFeedEvents(limit = 80) {
  return getStore().feed.slice(-limit).reverse();
}

export function appendAutonomousFeedEvent(event: AutonomousFeedEvent) {
  const store = getStore();
  store.feed.push(event);
  if (store.feed.length > 500) {
    store.feed = store.feed.slice(-500);
  }
  persistStore(store);
}

export function resetAutonomousStoreForTests() {
  const nextStore = {
    feed: [],
    snapshot: createInitialSnapshot(),
  };

  global.__goonclawAutonomousStore = nextStore;
  if (existsSync(STORE_PATH)) {
    unlinkSync(STORE_PATH);
  }
}
