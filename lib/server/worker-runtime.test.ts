import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cryptoModule = vi.hoisted(() => ({
  decryptJson: vi.fn(() => ({})),
}));

const chartModule = vi.hoisted(() => ({
  buildGeneratedFunscript: vi.fn(() => ({ actions: [] })),
  buildHandyStreamPoints: vi.fn(() => []),
  deriveLiveCommand: vi.fn(() => ({
    speed: 54,
    amplitude: 25,
    minY: 29,
    maxY: 79,
  })),
  loadChartSnapshot: vi.fn(async () => ({
    priceUsd: 0.001807,
    marketCapUsd: 1_066_556_985,
    change5mPct: 0,
  })),
}));

const devicesModule = vi.hoisted(() => ({
  createRuntimeAdapter: vi.fn(),
}));

const repositoryModule = vi.hoisted(() => ({
  acquireSessionLease: vi.fn(),
  getDevice: vi.fn(),
  getSession: vi.fn(),
  listRecoverableSessions: vi.fn(),
  markSessionStopped: vi.fn(),
  renewSessionLease: vi.fn(),
  upsertSession: vi.fn(),
}));

vi.mock("@/lib/server/crypto", () => cryptoModule);
vi.mock("@/lib/server/chart", () => chartModule);
vi.mock("@/lib/server/devices", () => devicesModule);
vi.mock("@/lib/server/repository", () => repositoryModule);

import { rehydrateRuntimeSessions } from "@/lib/server/worker-runtime";
import type { SessionRecord } from "@/lib/types";

describe("rehydrateRuntimeSessions", () => {
  const leasedSessions = new Map<string, SessionRecord>();
  const adapter = {
    type: "autoblow",
    connect: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    startLive: vi.fn(async () => undefined),
    updateLive: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    leasedSessions.clear();
    devicesModule.createRuntimeAdapter.mockReturnValue(adapter);
    repositoryModule.getDevice.mockResolvedValue({
      type: "autoblow",
      encryptedCredentials: "ciphertext",
    });
    repositoryModule.acquireSessionLease.mockImplementation(
      async (session: SessionRecord, ownerId: string) => {
        const leased = {
          ...session,
          runtimeOwnerId: ownerId,
          runtimeLeaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
        };
        leasedSessions.set(session.id, leased);
        return leased;
      },
    );
    repositoryModule.renewSessionLease.mockImplementation(
      async (sessionId: string, ownerId: string) => {
        const current = leasedSessions.get(sessionId);
        if (!current) {
          return null;
        }

        const renewed = {
          ...current,
          runtimeOwnerId: ownerId,
          runtimeLeaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
        };
        leasedSessions.set(sessionId, renewed);
        return renewed;
      },
    );
    repositoryModule.upsertSession.mockImplementation(async (session: SessionRecord) => {
      leasedSessions.set(session.id, session);
      return session;
    });
    repositoryModule.markSessionStopped.mockImplementation(
      async (sessionId: string, lastError?: string) => ({
        ...(leasedSessions.get(sessionId) ?? { id: sessionId }),
        status: lastError ? "error" : "stopped",
        lastError,
      }),
    );
    (globalThis as { __tianshiRuntime?: unknown }).__tianshiRuntime = undefined;
    (globalThis as { __tianshiRuntimeOwnerId?: string }).__tianshiRuntimeOwnerId =
      undefined;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis as { __tianshiRuntime?: unknown }).__tianshiRuntime = undefined;
    (globalThis as { __tianshiRuntimeOwnerId?: string }).__tianshiRuntimeOwnerId =
      undefined;
  });

  it("recovers only the newest recoverable session for a device", async () => {
    const newest: SessionRecord = {
      id: "session-newest",
      wallet: "public-livestream",
      contractAddress: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      deviceId: "public-autoblow",
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: "2026-03-23T19:35:00.000Z",
      updatedAt: "2026-03-23T19:35:20.000Z",
    };
    const older: SessionRecord = {
      ...newest,
      id: "session-older",
      updatedAt: "2026-03-23T19:35:10.000Z",
    };
    repositoryModule.listRecoverableSessions.mockResolvedValue([newest, older]);

    const result = await rehydrateRuntimeSessions();

    expect(result.recovered).toHaveLength(1);
    expect(result.recovered[0]?.id).toBe("session-newest");
    expect(repositoryModule.markSessionStopped).toHaveBeenCalledWith(
      "session-older",
      "Superseded by a newer recoverable session for this device",
    );
    expect(devicesModule.createRuntimeAdapter).toHaveBeenCalledTimes(1);
  });
});
