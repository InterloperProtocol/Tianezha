import { randomUUID } from "crypto";

import { decryptJson } from "@/lib/server/crypto";
import {
  buildGeneratedFunscript,
  buildHandyStreamPoints,
  deriveLiveCommand,
  loadChartSnapshot,
} from "@/lib/server/chart";
import { createRuntimeAdapter, RuntimeAdapter } from "@/lib/server/devices";
import {
  acquireSessionLease,
  getDevice,
  getSession,
  listRecoverableSessions,
  markSessionStopped,
  renewSessionLease,
  upsertSession,
} from "@/lib/server/repository";
import { SESSION_LEASE_TTL_MS } from "@/lib/server/runtime-constants";
import { DeviceCredentials, SessionRecord, SessionStartInput } from "@/lib/types";
import { nowIso } from "@/lib/utils";

type RuntimeSession = {
  session: SessionRecord;
  adapter: RuntimeAdapter;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  stopping: boolean;
};

declare global {
  var __tianshiRuntime: Map<string, RuntimeSession> | undefined;
  var __tianshiRuntimeOwnerId: string | undefined;
}

function getRuntimeMap() {
  if (!global.__tianshiRuntime) {
    global.__tianshiRuntime = new Map();
  }
  return global.__tianshiRuntime;
}

function getRuntimeOwnerId() {
  if (!global.__tianshiRuntimeOwnerId) {
    global.__tianshiRuntimeOwnerId = `runtime-${randomUUID()}`;
  }
  return global.__tianshiRuntimeOwnerId;
}

function getRuntimeDeviceKey(session: Pick<SessionRecord, "wallet" | "deviceId">) {
  return `${session.wallet}:${session.deviceId}`;
}

function getTickDelayMs(session: SessionRecord) {
  return session.mode === "live" ? 2_500 : 30_000;
}

function clearRuntimeTimer(runtime: RuntimeSession) {
  if (runtime.timer) {
    clearTimeout(runtime.timer);
    runtime.timer = null;
  }
}

function scheduleRuntimeTick(runtime: RuntimeSession, delayMs: number) {
  clearRuntimeTimer(runtime);
  runtime.timer = setTimeout(() => {
    void processRuntimeTick(runtime);
  }, delayMs);
}

async function stopDetachedSession(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return null;

  const profile = await getDevice(session.wallet, session.deviceId);
  if (profile) {
    try {
      const credentials = decryptJson<DeviceCredentials>(
        profile.encryptedCredentials,
      );
      const adapter = createRuntimeAdapter(profile, credentials);
      await adapter.connect().catch(() => null);
      await adapter.stop().catch(() => null);
    } catch {
      // Best-effort stop. We still mark the session stopped below.
    }
  }

  return markSessionStopped(sessionId);
}

async function failRuntimeSession(runtime: RuntimeSession, error: unknown) {
  runtime.stopping = true;
  clearRuntimeTimer(runtime);
  await runtime.adapter.stop().catch(() => null);
  getRuntimeMap().delete(runtime.session.id);
  return markSessionStopped(
    runtime.session.id,
    error instanceof Error ? error.message : "Runtime tick failed",
  );
}

async function runSessionTick(runtime: RuntimeSession) {
  const leasedSession = await renewSessionLease(
    runtime.session.id,
    getRuntimeOwnerId(),
    SESSION_LEASE_TTL_MS,
  );
  if (!leasedSession) {
    throw new Error("Session lease is held by another worker");
  }
  runtime.session = leasedSession;

  const snapshot = await loadChartSnapshot(runtime.session.contractAddress);

  if (runtime.session.mode === "live") {
    const command = deriveLiveCommand(snapshot, Date.now());
    const handyPoints =
      runtime.adapter.type === "handy"
        ? buildHandyStreamPoints(command)
        : undefined;

    if (!runtime.session.startedAt) {
      await runtime.adapter.startLive?.(command, handyPoints);
    } else {
      await runtime.adapter.updateLive?.(command, handyPoints);
    }

    runtime.session = {
      ...runtime.session,
      status: "active",
      startedAt: runtime.session.startedAt ?? nowIso(),
      updatedAt: nowIso(),
      snapshot: {
        speed: command.speed,
        amplitude: command.amplitude,
        minY: command.minY,
        maxY: command.maxY,
        priceUsd: snapshot.priceUsd,
        marketCapUsd: snapshot.marketCapUsd,
        change5mPct: snapshot.change5mPct,
      },
    };
  } else {
    if (!runtime.adapter.startScript) {
      throw new Error("This device does not support generated script mode");
    }

    const script = buildGeneratedFunscript(snapshot);
    const startedAtMs = runtime.session.startedAt
      ? new Date(runtime.session.startedAt).getTime()
      : Date.now();
    const resumeAtMs = Math.max(0, (Date.now() - startedAtMs) % 120_000);
    await runtime.adapter.startScript(script, resumeAtMs);

    const command = deriveLiveCommand(snapshot, Date.now());
    runtime.session = {
      ...runtime.session,
      status: "active",
      startedAt: runtime.session.startedAt ?? nowIso(),
      updatedAt: nowIso(),
      snapshot: {
        speed: command.speed,
        amplitude: command.amplitude,
        minY: command.minY,
        maxY: command.maxY,
        priceUsd: snapshot.priceUsd,
        marketCapUsd: snapshot.marketCapUsd,
        change5mPct: snapshot.change5mPct,
      },
    };
  }

  runtime.session = await upsertSession(runtime.session);
}

async function processRuntimeTick(runtime: RuntimeSession) {
  if (runtime.stopping || runtime.inFlight) {
    return;
  }

  runtime.inFlight = true;
  try {
    await runSessionTick(runtime);
  } catch (error) {
    await failRuntimeSession(runtime, error);
    return;
  } finally {
    runtime.inFlight = false;
  }

  if (
    !runtime.stopping &&
    getRuntimeMap().get(runtime.session.id) === runtime
  ) {
    scheduleRuntimeTick(runtime, getTickDelayMs(runtime.session));
  }
}

async function createRuntimeSession(
  session: SessionRecord,
  existingProfile?: Awaited<ReturnType<typeof getDevice>>,
) {
  const leasedSession = await acquireSessionLease(
    session,
    getRuntimeOwnerId(),
    SESSION_LEASE_TTL_MS,
  );
  if (!leasedSession) {
    throw new Error("Session is already claimed by another worker");
  }

  const profile = existingProfile ?? (await getDevice(session.wallet, session.deviceId));
  if (!profile) {
    throw new Error("Device not found");
  }

  const credentials = decryptJson<DeviceCredentials>(profile.encryptedCredentials);
  const adapter = createRuntimeAdapter(profile, credentials);
  await adapter.connect();

  const runtime: RuntimeSession = {
    session: leasedSession,
    adapter,
    timer: null,
    inFlight: false,
    stopping: false,
  };

  getRuntimeMap().set(runtime.session.id, runtime);
  try {
    await runSessionTick(runtime);
    scheduleRuntimeTick(runtime, getTickDelayMs(runtime.session));
    return runtime.session;
  } catch (error) {
    getRuntimeMap().delete(runtime.session.id);
    await adapter.stop().catch(() => null);
    await markSessionStopped(
      runtime.session.id,
      error instanceof Error ? error.message : "Failed to start runtime session",
    );
    throw error;
  }
}

export async function startRuntimeSession(input: SessionStartInput) {
  const profile = await getDevice(input.wallet, input.deviceId);
  if (!profile) {
    throw new Error("Device not found");
  }

  const recoverable = await listRecoverableSessions();
  for (const session of recoverable) {
    if (getRuntimeDeviceKey(session) !== getRuntimeDeviceKey(input)) {
      continue;
    }

    await stopRuntimeSession(session.id);
  }

  const timestamp = nowIso();
  const session: SessionRecord = {
    id: randomUUID(),
    wallet: input.wallet,
    contractAddress: input.contractAddress,
    deviceId: input.deviceId,
    deviceType: profile.type,
    mode: input.mode,
    status: "starting",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return createRuntimeSession(session, profile);
}

export async function stopRuntimeSession(sessionId: string) {
  const runtime = getRuntimeMap().get(sessionId);
  if (!runtime) {
    return stopDetachedSession(sessionId);
  }

  runtime.stopping = true;
  clearRuntimeTimer(runtime);
  await runtime.adapter.stop().catch(() => null);
  getRuntimeMap().delete(sessionId);
  return markSessionStopped(sessionId);
}

export function listRuntimeSessions() {
  return [...getRuntimeMap().values()].map((runtime) => runtime.session);
}

export async function rehydrateRuntimeSessions() {
  const recoverable = await listRecoverableSessions();
  const started: SessionRecord[] = [];
  const skipped: string[] = [];
  const claimedDeviceKeys = new Set<string>();

  for (const session of recoverable) {
    if (getRuntimeMap().has(session.id)) {
      skipped.push(session.id);
      continue;
    }

    const deviceKey = getRuntimeDeviceKey(session);
    if (claimedDeviceKeys.has(deviceKey)) {
      await markSessionStopped(
        session.id,
        "Superseded by a newer recoverable session for this device",
      );
      continue;
    }

    const activeRuntimeOnDevice = [...getRuntimeMap().values()].find(
      (runtime) => getRuntimeDeviceKey(runtime.session) === deviceKey,
    );
    if (activeRuntimeOnDevice) {
      if (activeRuntimeOnDevice.session.id === session.id) {
        skipped.push(session.id);
      } else {
        await markSessionStopped(
          session.id,
          "Superseded by another active session for this device",
        );
      }
      continue;
    }

    claimedDeviceKeys.add(deviceKey);

    try {
      const resumed = await createRuntimeSession({
        ...session,
        status: session.status === "active" ? "active" : "starting",
        updatedAt: nowIso(),
      });
      started.push(resumed);
    } catch (error) {
      await markSessionStopped(
        session.id,
        error instanceof Error ? error.message : "Failed to recover session",
      );
    }
  }

  return {
    recovered: started,
    skipped,
  };
}
