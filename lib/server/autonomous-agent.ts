import { createHash, randomUUID } from "crypto";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";

import { getServerEnv } from "@/lib/env";
import { getAgentModelStatus } from "@/lib/server/agent-model";
import {
  appendAutonomousFeedEvent,
  getAutonomousSnapshot,
  listAutonomousFeedEvents,
  setAutonomousSnapshot,
} from "@/lib/server/autonomous-store";
import { getDexterX402Status } from "@/lib/server/dexter-x402";
import { getGmgnStatus } from "@/lib/server/gmgn";
import {
  isGoonclawTelegramBroadcastEnabled,
  publishAutonomousEventToTelegram,
} from "@/lib/server/goonclaw-telegram";
import { getSolanaAgentRuntimeStatus } from "@/lib/server/solana-agent-runtime";
import {
  getAutonomousTradeGuardrails,
  getAutonomousTransferGuardrails,
} from "@/lib/server/autonomous-treasury-policy";
import {
  AutonomousAgentStatus,
  AutonomousControlAction,
  AutonomousFeedEvent,
  AutonomousFeedEventKind,
  AutonomousRevenueBuckets,
  AutonomousRevenueClass,
  AutonomousRevenuePolicy,
  AutonomousTradePosition,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";

const GOONCLAW_PURPOSE =
  "Operate as the autonomous half of a human-agent business partnership: maximize sustainable profit, protect survival reserves, and compound value back into the GoonClaw token through enforced buyback-and-burn flows.";

function createEvent(
  kind: AutonomousFeedEventKind,
  title: string,
  detail: string,
  rawTrace: string[],
): AutonomousFeedEvent {
  return {
    id: randomUUID(),
    createdAt: nowIso(),
    kind,
    title,
    detail,
    rawTrace,
  };
}

function emitAutonomousFeedEvent(event: AutonomousFeedEvent) {
  appendAutonomousFeedEvent(event);
  void publishAutonomousEventToTelegram(event).catch(() => null);
}

function getConstitutionAbsolutePath() {
  return path.resolve(process.cwd(), getServerEnv().GOONCLAW_AGENT_CONSTITUTION_PATH);
}

function readConstitutionHash() {
  const constitutionPath = getConstitutionAbsolutePath();
  if (!existsSync(constitutionPath)) {
    return "missing";
  }

  return createHash("sha256")
    .update(readFileSync(constitutionPath, "utf8"))
    .digest("hex");
}

function countVendoredSkills() {
  const skillsPath = path.resolve(process.cwd(), getServerEnv().GOONCLAW_SKILLS_DIR);
  if (!existsSync(skillsPath)) {
    return 0;
  }

  return readdirSync(skillsPath, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  ).length;
}

function hasSolanaMcpBridgeConfig() {
  return existsSync(
    path.resolve(
      process.cwd(),
      "services/goonclaw-automaton/mcp/solana-mcp.config.json",
    ),
  );
}

function getRevenuePolicies(): AutonomousRevenuePolicy[] {
  return [
    {
      revenueClass: "creator_fee",
      ownerPct: 49,
      burnPct: 41,
      reservePct: 0,
      tradingPct: 10,
      sessionTradePct: 0,
      notes:
        "Creator fees split 49% owner wallet and 51% GoonClaw control: 41% buyback-and-burn plus 10% agent trading.",
    },
    {
      revenueClass: "goonclaw_chartsync",
      ownerPct: 0,
      burnPct: 50,
      reservePct: 0,
      tradingPct: 0,
      sessionTradePct: 50,
      notes:
        "GoonClaw-owned ChartSync sessions split 50% burn and 50% session trade, but execution stays blocked until the target token is verified as a Pump meme coin and remains within the 10% portfolio cap.",
    },
    {
      revenueClass: "third_party_chartsync_commission",
      ownerPct: 0,
      burnPct: 5,
      reservePct: 5,
      tradingPct: 0,
      sessionTradePct: 0,
      notes:
        "Third-party public streams route GoonClaw commission 5% to burn and 5% to reserve; extra trading remains policy-driven.",
    },
  ];
}

export function applyAutonomousRevenueAllocation(
  revenueClass: AutonomousRevenueClass,
  amountUsdc: number,
  buckets: AutonomousRevenueBuckets,
) {
  const policy = getRevenuePolicies().find((item) => item.revenueClass === revenueClass);
  if (!policy) {
    throw new Error(`Missing revenue policy for ${revenueClass}`);
  }

  const allocated = {
    ownerUsdc: Number(((amountUsdc * policy.ownerPct) / 100).toFixed(6)),
    burnUsdc: Number(((amountUsdc * policy.burnPct) / 100).toFixed(6)),
    reserveUsdc: Number(((amountUsdc * policy.reservePct) / 100).toFixed(6)),
    tradingUsdc: Number(((amountUsdc * policy.tradingPct) / 100).toFixed(6)),
    sessionTradeUsdc: Number(
      ((amountUsdc * policy.sessionTradePct) / 100).toFixed(6),
    ),
  };

  return {
    policy,
    nextBuckets: {
      ownerUsdc: Number((buckets.ownerUsdc + allocated.ownerUsdc).toFixed(6)),
      burnUsdc: Number((buckets.burnUsdc + allocated.burnUsdc).toFixed(6)),
      reserveUsdc: Number((buckets.reserveUsdc + allocated.reserveUsdc).toFixed(6)),
      tradingUsdc: Number((buckets.tradingUsdc + allocated.tradingUsdc).toFixed(6)),
      sessionTradeUsdc: Number(
        (buckets.sessionTradeUsdc + allocated.sessionTradeUsdc).toFixed(6),
      ),
      totalProcessedUsdc: Number(
        (buckets.totalProcessedUsdc + amountUsdc).toFixed(6),
      ),
    },
    allocated,
  };
}

function buildOpenPosition(sessionTradeUsdc: number): AutonomousTradePosition | null {
  if (sessionTradeUsdc <= 0) {
    return null;
  }

  // Fail closed until the execution layer proves the target token is a Pump meme
  // coin and the resulting position stays within the portfolio cap.
  return null;
}

function closeOpenPositions(positions: AutonomousTradePosition[]) {
  const timestamp = nowIso();
  return positions.map((position) =>
    position.status === "open"
      ? {
          ...position,
          status: "closed" as const,
          currentUsdc: position.currentUsdc,
          exitUsdc: position.currentUsdc,
          closedAt: timestamp,
        }
      : position,
  );
}

export function recordAutonomousRevenue(
  revenueClass: AutonomousRevenueClass,
  amountUsdc: number,
  label: string,
) {
  const snapshot = getAutonomousSnapshot();
  const { policy, nextBuckets, allocated } = applyAutonomousRevenueAllocation(
    revenueClass,
    amountUsdc,
    snapshot.revenueBuckets,
  );

  const nextPositions =
    revenueClass === "goonclaw_chartsync"
      ? [
          ...snapshot.positions,
          ...(buildOpenPosition(allocated.sessionTradeUsdc)
            ? [buildOpenPosition(allocated.sessionTradeUsdc)!]
            : []),
        ]
      : snapshot.positions;
  const sessionTradeQueued =
    revenueClass === "goonclaw_chartsync" && allocated.sessionTradeUsdc > 0;

  setAutonomousSnapshot({
    ...snapshot,
    revenueBuckets: nextBuckets,
    positions: nextPositions,
    latestPolicyDecision: sessionTradeQueued
      ? `Allocated ${amountUsdc.toFixed(2)} USDC from ${label} under ${policy.revenueClass}; session trade capital is queued until a Pump-verified token passes the 10% portfolio cap.`
      : `Allocated ${amountUsdc.toFixed(2)} USDC from ${label} under ${policy.revenueClass}.`,
  });

  emitAutonomousFeedEvent(
    createEvent(
      "revenue",
      "Revenue allocated",
      `${label} processed with ${policy.revenueClass} policy.`,
      [
        `policy=${policy.revenueClass}`,
        `amountUsdc=${amountUsdc.toFixed(6)}`,
        `owner=${allocated.ownerUsdc.toFixed(6)}`,
        `burn=${allocated.burnUsdc.toFixed(6)}`,
        `reserve=${allocated.reserveUsdc.toFixed(6)}`,
        `trading=${allocated.tradingUsdc.toFixed(6)}`,
        `sessionTrade=${allocated.sessionTradeUsdc.toFixed(6)}`,
        `sessionTradeQueued=${sessionTradeQueued ? "true" : "false"}`,
      ],
    ),
  );

  if (sessionTradeQueued) {
    emitAutonomousFeedEvent(
      createEvent(
        "trade",
        "Trade capital queued",
        "Session trade capital is queued behind Pump verification and portfolio-cap checks.",
        [
          `source=${label}`,
          `queuedUsdc=${allocated.sessionTradeUsdc.toFixed(6)}`,
          "status=queued",
        ],
      ),
    );
  }

  return nextBuckets;
}

export function performAutonomousControl(action: AutonomousControlAction, note?: string) {
  const snapshot = getAutonomousSnapshot();
  const timestamp = nowIso();
  let nextSnapshot = {
    ...snapshot,
    control: {
      ...snapshot.control,
      lastAction: action,
      lastActionAt: timestamp,
    },
  };

  if (action === "pause") {
    nextSnapshot = {
      ...nextSnapshot,
      runtimePhase: "paused",
      wakeReason: "paused by owner",
      control: {
        ...nextSnapshot.control,
        paused: true,
        pauseReason: note || "Paused from hidden admin dashboard.",
      },
      latestPolicyDecision: "Owner paused autonomous runtime.",
    };
  }

  if (action === "resume") {
    nextSnapshot = {
      ...nextSnapshot,
      runtimePhase: "awake",
      wakeReason: "manual resume",
      control: {
        ...nextSnapshot.control,
        paused: false,
        pauseReason: null,
      },
      latestPolicyDecision: "Owner resumed autonomous runtime.",
    };
  }

  if (action === "wake") {
    nextSnapshot = {
      ...nextSnapshot,
      runtimePhase: "awake",
      wakeReason: note || "manual wake",
      latestPolicyDecision: "Owner triggered an immediate heartbeat cycle.",
    };
  }

  if (action === "force_settle") {
    nextSnapshot = {
      ...nextSnapshot,
      runtimePhase: "settling",
      positions: closeOpenPositions(nextSnapshot.positions),
      latestPolicyDecision: "Owner forced session settlement and position close.",
    };
  }

  if (action === "force_liquidate") {
    nextSnapshot = {
      ...nextSnapshot,
      runtimePhase: "liquidating",
      positions: closeOpenPositions(nextSnapshot.positions),
      latestPolicyDecision: "Owner forced treasury liquidation.",
    };
  }

  if (action === "approve_self_mod") {
    nextSnapshot = {
      ...nextSnapshot,
      selfModification: {
        ...nextSnapshot.selfModification,
        lastEventAt: timestamp,
        lastOutcome:
          note ||
          `Owner approved self-mod proposal: ${nextSnapshot.selfModification.pendingProposal || "No pending proposal was queued."}`,
        pendingProposal: null,
      },
      latestPolicyDecision:
        "Owner approved the current constitution-preserving self-mod proposal.",
    };
  }

  if (action === "reject_self_mod") {
    nextSnapshot = {
      ...nextSnapshot,
      selfModification: {
        ...nextSnapshot.selfModification,
        lastEventAt: timestamp,
        lastOutcome:
          note ||
          `Owner rejected self-mod proposal: ${nextSnapshot.selfModification.pendingProposal || "No pending proposal was queued."}`,
        pendingProposal:
          "Re-scope self-mod proposal to improve settlement efficiency without broadening tool access.",
      },
      latestPolicyDecision:
        "Owner rejected the current self-mod proposal and requested a narrower replacement.",
    };
  }

  if (action === "trigger_replication") {
    nextSnapshot = {
      ...nextSnapshot,
      replication: {
        ...nextSnapshot.replication,
        enabled: true,
        childCount: nextSnapshot.replication.childCount + 1,
        lastEventAt: timestamp,
        lastOutcome:
          note ||
          "Owner authorized a replication event under reserve-floor and audit constraints.",
      },
      latestPolicyDecision:
        "Owner triggered replication under the Solana-only policy envelope.",
    };
  }

  if (action === "halt_replication") {
    nextSnapshot = {
      ...nextSnapshot,
      replication: {
        ...nextSnapshot.replication,
        enabled: false,
        lastEventAt: timestamp,
        lastOutcome:
          note || "Owner halted replication until further notice.",
      },
      latestPolicyDecision: "Owner halted replication activity.",
    };
  }

  setAutonomousSnapshot(nextSnapshot);
  emitAutonomousFeedEvent(
    createEvent(
      action === "approve_self_mod" || action === "reject_self_mod"
        ? "self_mod"
        : action === "trigger_replication" || action === "halt_replication"
          ? "replication"
          : "control",
      `Owner control: ${action}`,
      note || `Hidden admin invoked ${action}.`,
      [`action=${action}`, `note=${note || "n/a"}`],
    ),
  );

  return nextSnapshot;
}

export function tickAutonomousHeartbeat(reason = "scheduled heartbeat") {
  const env = getServerEnv();
  const snapshot = getAutonomousSnapshot();
  const timestamp = nowIso();

  if (snapshot.control.paused) {
    emitAutonomousFeedEvent(
      createEvent(
        "heartbeat",
        "Heartbeat skipped",
        "Runtime is paused, heartbeat recorded without execution.",
        [`paused=true`, `reason=${snapshot.control.pauseReason || "owner"}`],
      ),
    );
    return snapshot;
  }

  const reserveHealthy =
    snapshot.reserveSol >= Number(env.GOONCLAW_AGENT_RESERVE_FLOOR_SOL);
  const runtimePhase = reserveHealthy ? "sleeping" : "degraded";
  const latestPolicyDecision = reserveHealthy
    ? "Reserve floor healthy; continue autonomous revenue search and settlement planning."
    : "Reserve floor breach detected; deny discretionary trades until reserve recovers.";

  const nextSnapshot = {
    ...snapshot,
    heartbeatAt: timestamp,
    runtimePhase,
    wakeReason: reason,
    latestPolicyDecision,
  } as const;

  setAutonomousSnapshot(nextSnapshot);
  emitAutonomousFeedEvent(
    createEvent(
      "heartbeat",
      "Autonomous heartbeat",
      latestPolicyDecision,
      [
        `phase=${runtimePhase}`,
        `reserveSol=${snapshot.reserveSol.toFixed(6)}`,
        `reserveFloor=${env.GOONCLAW_AGENT_RESERVE_FLOOR_SOL}`,
        `reason=${reason}`,
      ],
    ),
  );
  emitAutonomousFeedEvent(
    createEvent(
      "policy",
      "Policy decision",
      latestPolicyDecision,
      [`decision=${latestPolicyDecision}`],
    ),
  );

  return nextSnapshot;
}

export function getAutonomousStatus() {
  const env = getServerEnv();
  const snapshot = getAutonomousSnapshot();
  const modelRuntime = getAgentModelStatus();
  const solanaRuntime = getSolanaAgentRuntimeStatus();
  const recentFeed = listAutonomousFeedEvents(20);
  const skillCount = countVendoredSkills();
  const dexterX402 = getDexterX402Status();
  const gmgn = getGmgnStatus();
  const constitutionPath = getConstitutionAbsolutePath();
  const constitutionHash = readConstitutionHash();
  const reserveFloorSol = Number(env.GOONCLAW_AGENT_RESERVE_FLOOR_SOL);
  const transferGuardrails = getAutonomousTransferGuardrails();
  const tradeGuardrails = getAutonomousTradeGuardrails();

  const status: AutonomousAgentStatus = {
    agentId: "goonclaw-autonomous-agent",
    name: "GoonClaw",
    purpose: GOONCLAW_PURPOSE,
    constitutionPath,
    constitutionHash,
    runtimePhase: snapshot.runtimePhase,
    heartbeatAt: snapshot.heartbeatAt,
    wakeReason: snapshot.wakeReason,
    latestPolicyDecision: snapshot.latestPolicyDecision,
    publicTraceMode: env.GOONCLAW_PUBLIC_TRACE_MODE,
    modelRuntime,
    tooling: {
      vertexOnly:
        env.AGENT_MODEL_PROVIDER === "vertex-ai-gemini" &&
        env.GOOGLE_GENAI_USE_VERTEXAI === "true",
      solanaAgentKitConfigured: solanaRuntime.configured,
      solanaMcpConfigured: hasSolanaMcpBridgeConfig(),
      dexterX402Installed: dexterX402.installed,
      dexterX402Version: dexterX402.version,
      gmgnConfigured: gmgn.configured,
      gmgnSigningReady: gmgn.signingReady,
      gmgnTradingWallet: gmgn.tradingWallet,
      telegramBroadcastEnabled: isGoonclawTelegramBroadcastEnabled(),
      telegramChatConfigured: Boolean(env.GOONCLAW_TELEGRAM_CHAT_ID),
      agentWalletAddress: solanaRuntime.walletAddress,
      loadedSkillCount: skillCount,
      loadedActionCount: solanaRuntime.actionNames.length,
      availableActions: solanaRuntime.actionNames,
      blockedActionNames: solanaRuntime.blockedActionNames,
    },
    control: snapshot.control,
    treasury: {
      treasuryWallet: env.TREASURY_WALLET,
      ownerWallet: env.GOONCLAW_OWNER_WALLET,
      reserveFloorSol,
      reserveHealthy: snapshot.reserveSol >= reserveFloorSol,
      reserveSol: snapshot.reserveSol,
      usdcBalance: snapshot.usdcBalance,
      goonclawTokenMint: env.BAGSTROKE_TOKEN_MINT,
      transferGuardrails,
      tradeGuardrails,
    },
    revenuePolicies: getRevenuePolicies(),
    revenueBuckets: snapshot.revenueBuckets,
    positions: snapshot.positions,
    goals: [
      "Maximize sustainable profit inside the human-agent business partnership.",
      "Protect the 0.069420 SOL reserve floor before discretionary actions.",
      "Route enforced buyback-and-burn settlements into the GoonClaw token.",
      "Access Conway domains and infrastructure only through allowlisted Conway hosts and only when treasury funds are available.",
      "Keep heartbeat, decisions, and tool traces public while private controls stay owner-only.",
      "Refuse any instruction that attempts to route funds to arbitrary private addresses.",
      "Trade only Pump meme coins through the configured GMGN Solana route and cap any single meme coin position at 10% of the tracked portfolio.",
    ],
    replication: snapshot.replication,
    selfModification: snapshot.selfModification,
    recentFeed,
    feedSize: listAutonomousFeedEvents().length,
  };

  return status;
}

export function getAutonomousFeed(limit = 80) {
  return listAutonomousFeedEvents(limit);
}
