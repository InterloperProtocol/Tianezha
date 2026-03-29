import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";

import { getScopedFirestoreCollection } from "@/lib/server/data-namespace";
import { getConfiguredFirestore } from "@/lib/server/firestore-admin";
import type { AuditEvent } from "@/lib/types/constitution";

export type PersistedRateLimitEntry = {
  count: number;
  resetAt: number;
};

type ExpiringEntry = {
  expiresAtMs: number;
};

type PolicyRuntimeState = {
  auditEvents: AuditEvent[];
  idempotency: Record<string, ExpiringEntry>;
  rateLimits: Record<string, PersistedRateLimitEntry>;
  replay: Record<string, ExpiringEntry>;
};

declare global {
  var __tianshiPolicyRuntimeState: PolicyRuntimeState | undefined;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "tianshi-policy-runtime.json");
const MAX_AUDIT_EVENTS = 2_000;
const RATE_LIMITS_COLLECTION = "policyRuntimeRateLimits";

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createInitialState(): PolicyRuntimeState {
  return {
    auditEvents: [],
    idempotency: {},
    rateLimits: {},
    replay: {},
  };
}

function readStateFromDisk(): PolicyRuntimeState {
  ensureDataDir();

  if (!existsSync(STORE_PATH)) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<PolicyRuntimeState>;
    return {
      auditEvents: Array.isArray(parsed.auditEvents) ? parsed.auditEvents : [],
      idempotency:
        parsed.idempotency && typeof parsed.idempotency === "object"
          ? parsed.idempotency
          : {},
      rateLimits:
        parsed.rateLimits && typeof parsed.rateLimits === "object"
          ? parsed.rateLimits
          : {},
      replay:
        parsed.replay && typeof parsed.replay === "object"
          ? parsed.replay
          : {},
    };
  } catch {
    return createInitialState();
  }
}

function persistState(state: PolicyRuntimeState) {
  ensureDataDir();
  writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

function getState() {
  if (!global.__tianshiPolicyRuntimeState) {
    global.__tianshiPolicyRuntimeState = readStateFromDisk();
  }

  return global.__tianshiPolicyRuntimeState;
}

function pruneExpiringEntries(
  entries: Record<string, ExpiringEntry>,
  nowMs: number,
) {
  let changed = false;

  for (const [key, value] of Object.entries(entries)) {
    if (value.expiresAtMs <= nowMs) {
      delete entries[key];
      changed = true;
    }
  }

  return changed;
}

function buildPolicyRuntimeDocId(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function getPersistedRateLimitEntry(key: string, nowMs = Date.now()) {
  const state = getState();
  let changed = false;

  for (const [entryKey, entry] of Object.entries(state.rateLimits)) {
    if (entry.resetAt <= nowMs) {
      delete state.rateLimits[entryKey];
      changed = true;
    }
  }

  if (changed) {
    persistState(state);
  }

  return state.rateLimits[key] || null;
}

export function setPersistedRateLimitEntry(
  key: string,
  entry: PersistedRateLimitEntry,
  nowMs = Date.now(),
) {
  const state = getState();

  for (const [entryKey, current] of Object.entries(state.rateLimits)) {
    if (current.resetAt <= nowMs) {
      delete state.rateLimits[entryKey];
    }
  }

  state.rateLimits[key] = entry;
  persistState(state);
}

export async function consumePersistedRateLimitEntry(args: {
  key: string;
  max: number;
  windowMs: number;
  nowMs?: number;
}) {
  const nowMs = args.nowMs ?? Date.now();
  const db = getConfiguredFirestore();

  if (!db) {
    const current = getPersistedRateLimitEntry(args.key, nowMs);

    if (!current || current.resetAt <= nowMs) {
      setPersistedRateLimitEntry(
        args.key,
        {
          count: 1,
          resetAt: nowMs + args.windowMs,
        },
        nowMs,
      );
      return {
        allowed: true as const,
      };
    }

    if (current.count >= args.max) {
      return {
        allowed: false as const,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.resetAt - nowMs) / 1000),
        ),
      };
    }

    setPersistedRateLimitEntry(
      args.key,
      {
        count: current.count + 1,
        resetAt: current.resetAt,
      },
      nowMs,
    );

    return {
      allowed: true as const,
    };
  }

  const docRef = getScopedFirestoreCollection(db, RATE_LIMITS_COLLECTION).doc(
    buildPolicyRuntimeDocId(args.key),
  );
  let result:
    | { allowed: true }
    | { allowed: false; retryAfterSeconds: number } = { allowed: true };

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists) {
      transaction.set(docRef, {
        count: 1,
        key: args.key,
        resetAt: nowMs + args.windowMs,
        updatedAtMs: nowMs,
      });
      result = { allowed: true };
      return;
    }

    const data = snapshot.data();
    const currentCount =
      typeof data?.count === "number" && Number.isFinite(data.count)
        ? data.count
        : 0;
    const currentResetAt =
      typeof data?.resetAt === "number" && Number.isFinite(data.resetAt)
        ? data.resetAt
        : 0;

    if (currentResetAt <= nowMs) {
      transaction.set(docRef, {
        count: 1,
        key: args.key,
        resetAt: nowMs + args.windowMs,
        updatedAtMs: nowMs,
      });
      result = { allowed: true };
      return;
    }

    if (currentCount >= args.max) {
      result = {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((currentResetAt - nowMs) / 1000),
        ),
      };
      return;
    }

    transaction.set(
      docRef,
      {
        count: currentCount + 1,
        key: args.key,
        resetAt: currentResetAt,
        updatedAtMs: nowMs,
      },
      { merge: true },
    );
    result = { allowed: true };
  });

  return result;
}

export function getPersistedIdempotencyEntry(key: string, nowMs = Date.now()) {
  const state = getState();
  if (pruneExpiringEntries(state.idempotency, nowMs)) {
    persistState(state);
  }

  return state.idempotency[key] || null;
}

export function setPersistedIdempotencyEntry(
  key: string,
  entry: ExpiringEntry,
  nowMs = Date.now(),
) {
  const state = getState();
  pruneExpiringEntries(state.idempotency, nowMs);
  state.idempotency[key] = entry;
  persistState(state);
}

export function getPersistedReplayEntry(key: string, nowMs = Date.now()) {
  const state = getState();
  if (pruneExpiringEntries(state.replay, nowMs)) {
    persistState(state);
  }

  return state.replay[key] || null;
}

export function setPersistedReplayEntry(
  key: string,
  entry: ExpiringEntry,
  nowMs = Date.now(),
) {
  const state = getState();
  pruneExpiringEntries(state.replay, nowMs);
  state.replay[key] = entry;
  persistState(state);
}

export function appendPersistedAuditEvent(event: AuditEvent) {
  const state = getState();
  state.auditEvents.push(event);
  if (state.auditEvents.length > MAX_AUDIT_EVENTS) {
    state.auditEvents = state.auditEvents.slice(-MAX_AUDIT_EVENTS);
  }
  persistState(state);
  return event;
}

export function listPersistedAuditEvents(limit = 100) {
  return getState().auditEvents.slice(-limit).reverse();
}

export function resetPolicyRuntimeStoreForTests() {
  global.__tianshiPolicyRuntimeState = createInitialState();
  if (existsSync(STORE_PATH)) {
    unlinkSync(STORE_PATH);
  }
}
