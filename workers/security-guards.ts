import { createHash } from "crypto";

import {
  getPersistedIdempotencyEntry,
  getPersistedReplayEntry,
  setPersistedIdempotencyEntry,
  setPersistedReplayEntry,
} from "@/lib/server/policy-runtime-store";
import {
  CONSTITUTION,
  assertChildBrainCannotExecute,
  assertReserveFloorAfterOutflow,
  availableAboveReserve,
  mulLamportsBps,
} from "@/lib/constitution";
import type {
  ActorRole,
  CircuitBreakerState,
  ConstitutionConfig,
  Lamports,
  ReadonlyDeep,
} from "@/lib/types/constitution";

export type TreasuryActionKind = "buyback" | "trade" | "treasury_outflow";
export type CanonicalMutationTarget =
  | "treasury"
  | "reserve"
  | "arbitration"
  | "canonical_state"
  | "audit_log";
export type EmergencyMode = "normal" | "parent_only" | "child_quarantine";

export function hashReplayFingerprint(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function assertIdempotencyKeyUnused(args: {
  idempotencyKey: string;
  nowMs?: number;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  const nowMs = args.nowMs ?? Date.now();

  if (getPersistedIdempotencyEntry(args.idempotencyKey, nowMs)) {
    throw new Error("Idempotency key has already been consumed.");
  }

  setPersistedIdempotencyEntry(
    args.idempotencyKey,
    {
      expiresAtMs: nowMs + cfg.securityPolicy.idempotency.windowMs,
    },
    nowMs,
  );
}

export function assertReplayFingerprintUnused(args: {
  fingerprint: string;
  nowMs?: number;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  const nowMs = args.nowMs ?? Date.now();

  if (getPersistedReplayEntry(args.fingerprint, nowMs)) {
    throw new Error("Replay-protection fingerprint has already been consumed.");
  }

  setPersistedReplayEntry(
    args.fingerprint,
    {
      expiresAtMs: nowMs + cfg.securityPolicy.replayProtection.ttlMs,
    },
    nowMs,
  );
}

export function assertSlippageWithinPolicy(args: {
  action: Exclude<TreasuryActionKind, "treasury_outflow">;
  slippageBps: number;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  const maxSlippageBps =
    args.action === "buyback"
      ? cfg.securityPolicy.slippage.maxBuybackSlippageBps
      : cfg.securityPolicy.slippage.maxTradeSlippageBps;

  if (args.slippageBps > maxSlippageBps) {
    throw new Error(
      `${args.action} slippage ${args.slippageBps} bps exceeds constitutional max ${maxSlippageBps} bps.`,
    );
  }
}

export function assertDailyLossWithinPolicy(args: {
  dailyLossBps: number;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  if (
    args.dailyLossBps >
    cfg.securityPolicy.lossLimits.maxDailyLossBpsOfTradingWallet
  ) {
    throw new Error("Daily loss limit exceeds the constitutional maximum.");
  }
}

export function assertParentBrainExecutionAuthority(args: {
  actingBrainId: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  if (args.actingBrainId !== cfg.parentChildPolicy.sovereignParentBrainId) {
    throw new Error(
      `Only ${cfg.parentChildPolicy.sovereignParentDisplayName} may execute globally.`,
    );
  }
}

export function assertCanonicalStateWriteAuthority(args: {
  actingBrainId: string;
  target: CanonicalMutationTarget;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  if (args.actingBrainId !== cfg.canonicalStatePolicy.singleWriterBrainId) {
    throw new Error(
      `Canonical ${args.target} writes are restricted to ${cfg.canonicalStatePolicy.singleWriterBrainId}.`,
    );
  }
}

export function assertServerOnlyEconomicMutation(args: {
  source: "client" | "server";
}) {
  if (args.source !== "server") {
    throw new Error("Client-provided economic state is not authoritative.");
  }
}

export function assertSpendCapWithinEpoch(args: {
  action: TreasuryActionKind;
  requestedLamports: Lamports;
  currentTreasuryLamports: Lamports;
  outflowThisEpochLamports: Lamports;
  buybackThisEpochLamports: Lamports;
  tradingNotionalThisEpochLamports: Lamports;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  const availableLamports = availableAboveReserve(
    args.currentTreasuryLamports,
    cfg.reservePolicy.reserveFloorLamports,
  );
  const maxOutflowLamports = mulLamportsBps(
    availableLamports,
    cfg.securityPolicy.spendCaps.maxOutflowPerEpochBpsOfAvailable,
  );

  if (args.outflowThisEpochLamports + args.requestedLamports > maxOutflowLamports) {
    throw new Error("Treasury outflow exceeds the constitutional epoch cap.");
  }

  assertReserveFloorAfterOutflow({
    currentTreasuryLamports: args.currentTreasuryLamports,
    requestedOutflowLamports: args.requestedLamports,
    reserveFloorLamports: cfg.reservePolicy.reserveFloorLamports,
  });

  if (args.action === "buyback") {
    const maxBuybackLamports = mulLamportsBps(
      availableLamports,
      cfg.securityPolicy.spendCaps.maxBuybackPerEpochBpsOfAvailable,
    );
    if (
      args.buybackThisEpochLamports + args.requestedLamports >
      maxBuybackLamports
    ) {
      throw new Error("Buyback spend exceeds the constitutional epoch cap.");
    }
  }

  if (args.action === "trade") {
    const maxTradingLamports = mulLamportsBps(
      availableLamports,
      cfg.securityPolicy.spendCaps.maxTradingNotionalPerEpochBpsOfAvailable,
    );
    if (
      args.tradingNotionalThisEpochLamports + args.requestedLamports >
      maxTradingLamports
    ) {
      throw new Error("Trading notional exceeds the constitutional epoch cap.");
    }
  }
}

export function createClosedCircuitBreakerState(nowMs = Date.now()): CircuitBreakerState {
  return {
    status: "closed",
    consecutiveFailures: 0,
    lastUpdatedAtMs: nowMs,
  };
}

export function evaluateCircuitBreaker(args: {
  state: CircuitBreakerState;
  nowMs?: number;
  consecutiveFailures?: number;
  dailyLossBps?: number;
  abnormalOutflowBps?: number;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}): CircuitBreakerState {
  const cfg = args.cfg ?? CONSTITUTION;
  const nowMs = args.nowMs ?? Date.now();
  const policy = cfg.securityPolicy.circuitBreaker;
  const consecutiveFailures =
    args.consecutiveFailures ?? args.state.consecutiveFailures;
  const dailyLossBps = args.dailyLossBps ?? 0;
  const abnormalOutflowBps = args.abnormalOutflowBps ?? 0;

  if (
    consecutiveFailures >= policy.tripOnConsecutiveFailures ||
    dailyLossBps >= policy.tripOnMaxDailyLossBps ||
    abnormalOutflowBps >= policy.tripOnAbnormalOutflowBps
  ) {
    return {
      status: "open",
      openedAtMs:
        args.state.status === "open" ? args.state.openedAtMs ?? nowMs : nowMs,
      reason:
        dailyLossBps >= policy.tripOnMaxDailyLossBps
          ? "daily-loss-limit"
          : abnormalOutflowBps >= policy.tripOnAbnormalOutflowBps
            ? "abnormal-outflow"
            : "consecutive-failures",
      consecutiveFailures,
      lastUpdatedAtMs: nowMs,
    };
  }

  if (
    args.state.status === "open" &&
    args.state.openedAtMs &&
    nowMs - args.state.openedAtMs >= policy.openStateMinDurationMs
  ) {
    return {
      status: "half_open",
      openedAtMs: args.state.openedAtMs,
      reason: args.state.reason,
      consecutiveFailures,
      lastUpdatedAtMs: nowMs,
    };
  }

  if (args.state.status === "half_open" && consecutiveFailures === 0) {
    return createClosedCircuitBreakerState(nowMs);
  }

  return {
    ...args.state,
    consecutiveFailures,
    lastUpdatedAtMs: nowMs,
  };
}

export function assertCircuitBreakerAllowsAction(state: CircuitBreakerState) {
  if (state.status === "open") {
    throw new Error("Circuit breaker is open.");
  }
}

export function assertRolePermission(args: {
  actorRole: ActorRole;
  allowedRoles: ReadonlyArray<ActorRole>;
}) {
  if (!args.allowedRoles.includes(args.actorRole)) {
    throw new Error(`Role ${args.actorRole} is not authorized for this action.`);
  }
}

export function assertChildBrainExecutionDenied(args: {
  actingBrainId: string;
  requestedAction?: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  assertChildBrainCannotExecute({
    actingBrainId: args.actingBrainId,
    attemptedAction: args.requestedAction,
    cfg: args.cfg,
  });
}

export function assertEmergencyModeGuard(args: {
  mode: EmergencyMode;
  actingBrainId: string;
  allowParentOverride?: boolean;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  if (args.mode === "normal") {
    return;
  }

  const cfg = args.cfg ?? CONSTITUTION;
  const parentBrainId = cfg.parentChildPolicy.sovereignParentBrainId;

  if (
    args.mode === "parent_only" &&
    args.allowParentOverride &&
    args.actingBrainId === parentBrainId
  ) {
    return;
  }

  throw new Error(
    `Emergency mode ${args.mode} blocks this action unless ${parentBrainId} is explicitly allowed to override.`,
  );
}
