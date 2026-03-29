import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetServerEnvForTests } from "@/lib/env";

const mocks = vi.hoisted(() => {
  const payload = {
    create: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
  };

  return {
    cookieJar: {
      delete: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    },
    payload,
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieJar),
}));

vi.mock("@/lib/server/autonomous-agent", () => ({
  getAutonomousRuntimeSummary: vi.fn(),
  getAutonomousStatusWithLiveReserve: vi.fn(),
}));

vi.mock("@/lib/server/repository", () => ({
  getSession: vi.fn(),
  listBitClawPosts: vi.fn(),
  listPublicStreamProfiles: vi.fn(),
  listRecoverableSessions: vi.fn(),
  upsertPublicStreamProfile: vi.fn(),
}));

vi.mock("@/lib/server/solana", () => ({
  getWalletSolBalance: vi.fn(),
}));

vi.mock("@/lib/server/payload", () => ({
  getPayloadClient: vi.fn(async () => mocks.payload),
}));

import {
  ensureSeededInternalAdmin,
  getInternalAdminDashboardData,
} from "@/lib/server/internal-admin";

describe("ensureSeededInternalAdmin", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_ADMIN_LOGIN", "admin");
    vi.stubEnv("INTERNAL_ADMIN_PASSWORD", "seeded-password");
    resetServerEnvForTests();

    mocks.payload.find.mockReset();
    mocks.payload.update.mockReset();
    mocks.payload.create.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvForTests();
  });

  it("creates the configured seeded admin instead of overwriting a different account", async () => {
    mocks.payload.find.mockResolvedValue({
      docs: [{ id: "manual-admin", username: "manual-owner" }],
    });
    mocks.payload.create.mockResolvedValue({
      displayName: "Internal Admin",
      id: "seeded-admin",
      username: "admin",
    });

    const admin = await ensureSeededInternalAdmin();

    expect(mocks.payload.update).not.toHaveBeenCalled();
    expect(mocks.payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "admins",
        data: expect.objectContaining({
          email: "admin@tianshi.internal",
          username: "admin",
        }),
      }),
    );
    expect(admin).toEqual({
      displayName: "Internal Admin",
      id: "seeded-admin",
      username: "admin",
    });
  });

  it("updates the existing seeded admin when the configured username already exists", async () => {
    mocks.payload.find.mockResolvedValue({
      docs: [{ id: "existing-admin", username: "admin" }],
    });
    mocks.payload.update.mockResolvedValue({
      displayName: "Internal Admin",
      id: "existing-admin",
      username: "admin",
    });

    const admin = await ensureSeededInternalAdmin();

    expect(mocks.payload.create).not.toHaveBeenCalled();
    expect(mocks.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "admins",
        id: "existing-admin",
      }),
    );
    expect(admin).toEqual({
      displayName: "Internal Admin",
      id: "existing-admin",
      username: "admin",
    });
  });
});

describe("getInternalAdminDashboardData", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_ADMIN_LOGIN", "admin");
    vi.stubEnv("INTERNAL_ADMIN_PASSWORD", "seeded-password");
    resetServerEnvForTests();

    mocks.payload.find.mockReset();
    mocks.payload.update.mockReset();
    mocks.payload.create.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvForTests();
  });

  it("includes live funding wallet balances for the owner cockpit", async () => {
    const autonomousAgentModule = await import("@/lib/server/autonomous-agent");
    const repositoryModule = await import("@/lib/server/repository");
    const solanaModule = await import("@/lib/server/solana");

    mocks.payload.find.mockResolvedValue({ docs: [] });
    vi.mocked(repositoryModule.listPublicStreamProfiles).mockResolvedValue([]);
    vi.mocked(repositoryModule.listRecoverableSessions).mockResolvedValue([]);
    vi.mocked(repositoryModule.listBitClawPosts).mockResolvedValue([]);
    vi.mocked(solanaModule.getWalletSolBalance).mockResolvedValue(12.345678);
    vi.mocked(autonomousAgentModule.getAutonomousStatusWithLiveReserve).mockResolvedValue(
      {
        control: {
          lastAction: "wake",
          lastActionAt: "2026-03-28T12:00:00.000Z",
          paused: false,
          pauseReason: null,
        },
        heartbeatAt: "2026-03-28T12:00:00.000Z",
        latestPolicyDecision: "All systems green.",
        positions: [],
        publicTraceMode: "owner-only",
        replication: {
          childCount: 0,
          enabled: false,
        },
        reportCommerce: {
          postPurchaseTradeDelaySeconds: 1,
          priceUsdc: 0.01,
          purchaseWindowSeconds: 1,
        },
        selfModification: {
          pendingProposal: null,
        },
        settlements: [],
        tooling: {
          agentWalletAddress: "So11111111111111111111111111111111111111112",
        },
        tradeDirectives: [],
        treasury: {
          ownerWallet: "So22222222222222222222222222222222222222222",
          reserveFloorSol: 0.5,
          reserveHealthy: true,
          reserveSol: 8.765432,
          riskControlPlane: {
            evidenceReplay: {
              evidenceRequired: false,
              replayRequired: false,
            },
            liveTradingAllowed: false,
            mutationLock: {
              locked: true,
            },
          } as never,
          transferGuardrails: {
            arbitraryTransfersBlocked: true,
          } as never,
          tradeGuardrails: {} as never,
          treasuryWallet: "So33333333333333333333333333333333333333333",
          usdcBalance: 42.5,
        },
        runtimePhase: "awake",
      } as never,
    );

    const dashboard = await getInternalAdminDashboardData();

    expect(dashboard.fundingWallets).toEqual([
      expect.objectContaining({
        address: "So11111111111111111111111111111111111111112",
        balanceSol: 12.345678,
        label: "Agent wallet",
      }),
      expect.objectContaining({
        address: "So33333333333333333333333333333333333333333",
        balanceSol: 8.765432,
        label: "Treasury wallet",
        usdcBalance: 42.5,
      }),
    ]);
  });
});
