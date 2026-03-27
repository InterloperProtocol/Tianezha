import { beforeEach, describe, expect, it, vi } from "vitest";

const envModule = vi.hoisted(() => ({
  getPublicEnv: vi.fn(() => ({
    NEXT_PUBLIC_LIVESTREAM_EMBED_URL: "https://example.com/embed",
  })),
  getServerEnv: vi.fn(() => ({
    TIANSHI_PAYMENT_SWEEP_SECRET: "test-sweep-secret",
    LIVESTREAM_CONTRACT_COOLDOWN_SECONDS: "60",
    LIVESTREAM_MAX_QUEUE_LENGTH: "20",
    LIVESTREAM_PRIORITY_PRICE_SOL: "0.01",
    LIVESTREAM_REQUESTER_COOLDOWN_SECONDS: "60",
    LIVESTREAM_SESSION_SECONDS: "120",
    LIVESTREAM_STANDARD_PRICE_SOL: "0.0069",
    PUBLIC_AUTOBLOW_DEVICE_LABEL: "Public Autoblow",
    PUBLIC_AUTOBLOW_DEVICE_TOKEN: "",
    TREASURY_WALLET: "TreasuryWallet1111111111111111111111111111111",
  })),
  isFirebaseConfigured: vi.fn(() => false),
  isProductionEnv: vi.fn(() => false),
}));

const smartWalletModule = vi.hoisted(() => ({
  fetchWalletAnalytics: vi.fn(),
}));

const workerClientModule = vi.hoisted(() => ({
  dispatchSessionStart: vi.fn(),
  dispatchSessionStop: vi.fn(),
}));

const solanaModule = vi.hoisted(() => ({
  createDedicatedPaymentAddress: vi.fn(),
  sweepDedicatedPaymentToTreasury: vi.fn(),
  verifyMemoTransferToTreasury: vi.fn(),
  verifyTransferToAddress: vi.fn(),
}));

vi.mock("@/lib/env", () => envModule);
vi.mock("@/lib/server/tianshi-smart-wallets", () => smartWalletModule);
vi.mock("@/lib/server/worker-client", () => workerClientModule);
vi.mock("@/lib/server/solana", () => solanaModule);

import {
  getLivestreamState,
  syncLivestreamQueue,
  verifyLivestreamRequestPayment,
} from "@/lib/server/livestream";
import {
  getLivestreamRequest,
  upsertSession,
  upsertLivestreamRequest,
} from "@/lib/server/repository";
import type { LivestreamRequestRecord } from "@/lib/types";
import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import {
  PUBLIC_LIVESTREAM_DEVICE_ID,
  PUBLIC_LIVESTREAM_OWNER_ID,
} from "@/lib/server/runtime-constants";

function buildRequest(
  overrides: Partial<LivestreamRequestRecord> = {},
): LivestreamRequestRecord {
  const timestamp = new Date().toISOString();
  return {
    id: "request-1",
    guestId: "guest-1",
    contractAddress: "PumpMint1111111111111111111111111111111111",
    memo: "PUMP-TEST",
    tier: "standard",
    amountLamports: "6900000",
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("livestream payment verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    smartWalletModule.fetchWalletAnalytics.mockResolvedValue(null);
    workerClientModule.dispatchSessionStop.mockResolvedValue(undefined);
    (globalThis as { __tianshiMemory?: unknown }).__tianshiMemory = undefined;
    (globalThis as { __tianshiLivestreamQueueSync?: Promise<void> }).__tianshiLivestreamQueueSync =
      undefined;
  });

  it("accepts legacy treasury-memo requests and re-queues them", async () => {
    solanaModule.verifyMemoTransferToTreasury.mockResolvedValue({
      ok: true,
      lamports: BigInt(6_900_000),
      payerWallet: "payer-wallet",
    });

    await upsertLivestreamRequest(
      buildRequest({
        id: "legacy-request",
        memo: "PUMP-LEGACY",
        paymentRouting: "treasury_memo",
      }),
    );

    const verified = await verifyLivestreamRequestPayment(
      "guest-1",
      "legacy-request",
      "sig-legacy",
    );
    const state = await getLivestreamState("guest-1");

    expect(solanaModule.verifyTransferToAddress).not.toHaveBeenCalled();
    expect(solanaModule.sweepDedicatedPaymentToTreasury).not.toHaveBeenCalled();
    expect(verified?.paymentRouting).toBe("treasury_memo");
    expect(verified?.sweepStatus).toBe("swept");
    expect(verified?.signature).toBe("sig-legacy");
    expect(state.queue.some((item) => item.id === "legacy-request")).toBe(true);
  });

  it("persists payment confirmation details when the dedicated-wallet sweep throws", async () => {
    solanaModule.verifyTransferToAddress.mockResolvedValue({
      ok: true,
      lamports: BigInt(6_900_000),
      payerWallet: "payer-wallet",
    });
    solanaModule.sweepDedicatedPaymentToTreasury.mockRejectedValue(
      new Error("sweep exploded"),
    );

    await upsertLivestreamRequest(
      buildRequest({
        id: "dedicated-request",
        paymentAddress: "DedicatedPaymentWallet1111111111111111111111",
        paymentRouting: "dedicated_address",
        paymentSecretCiphertext: "ciphertext",
        sweepStatus: "pending",
        sweptLamports: "0",
      }),
    );

    await expect(
      verifyLivestreamRequestPayment("guest-1", "dedicated-request", "sig-dedicated"),
    ).rejects.toThrow("sweep exploded");

    const saved = await getLivestreamRequest("dedicated-request");
    expect(saved?.signature).toBe("sig-dedicated");
    expect(saved?.paymentConfirmedAt).toBeTruthy();
    expect(saved?.receivedLamports).toBe("6900000");
    expect(saved?.sweepStatus).toBe("failed");
    expect(saved?.sweepError).toBe("sweep exploded");
    expect(saved?.error).toBe("sweep exploded");
  });

  it("starts an idle public chartsync session when the public Autoblow device is configured", async () => {
    envModule.getServerEnv.mockReturnValue({
      ...envModule.getServerEnv(),
      PUBLIC_AUTOBLOW_DEVICE_TOKEN: "71nt0tdpv35q",
    });
    workerClientModule.dispatchSessionStart.mockResolvedValue({
      id: "public-session-1",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "starting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await syncLivestreamQueue();

    expect(workerClientModule.dispatchSessionStart).toHaveBeenCalledWith({
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      mode: "live",
    });
  });

  it("reuses an existing idle public chartsync session when it already tracks the default mint", async () => {
    envModule.getServerEnv.mockReturnValue({
      ...envModule.getServerEnv(),
      PUBLIC_AUTOBLOW_DEVICE_TOKEN: "71nt0tdpv35q",
    });
    await upsertSession({
      id: "public-session-existing",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runtimeOwnerId: "runtime-1",
      runtimeLeaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await syncLivestreamQueue();

    expect(workerClientModule.dispatchSessionStart).not.toHaveBeenCalled();
    expect(workerClientModule.dispatchSessionStop).not.toHaveBeenCalled();
  });

  it("replaces a stale idle public chartsync session whose runtime lease expired", async () => {
    envModule.getServerEnv.mockReturnValue({
      ...envModule.getServerEnv(),
      PUBLIC_AUTOBLOW_DEVICE_TOKEN: "71nt0tdpv35q",
    });
    await upsertSession({
      id: "public-session-stale",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runtimeOwnerId: "runtime-old",
      runtimeLeaseExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    workerClientModule.dispatchSessionStart.mockResolvedValue({
      id: "public-session-fresh",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "starting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await syncLivestreamQueue();

    expect(workerClientModule.dispatchSessionStop).toHaveBeenCalledWith(
      "public-session-stale",
    );
    expect(workerClientModule.dispatchSessionStart).toHaveBeenCalledWith({
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      mode: "live",
    });
  });

  it("stops duplicate active public chartsync sessions and keeps the newest one", async () => {
    envModule.getServerEnv.mockReturnValue({
      ...envModule.getServerEnv(),
      PUBLIC_AUTOBLOW_DEVICE_TOKEN: "71nt0tdpv35q",
    });
    await upsertSession({
      id: "public-session-newest",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date(Date.now() + 1_000).toISOString(),
      runtimeOwnerId: "runtime-new",
      runtimeLeaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await upsertSession({
      id: "public-session-older",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runtimeOwnerId: "runtime-old",
      runtimeLeaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await syncLivestreamQueue();

    expect(workerClientModule.dispatchSessionStop).toHaveBeenCalledWith(
      "public-session-older",
    );
    expect(workerClientModule.dispatchSessionStart).not.toHaveBeenCalled();
  });

  it("hands the public device from the idle chartsync session to the next paid queue request", async () => {
    envModule.getServerEnv.mockReturnValue({
      ...envModule.getServerEnv(),
      PUBLIC_AUTOBLOW_DEVICE_TOKEN: "71nt0tdpv35q",
    });
    await upsertSession({
      id: "public-session-existing",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runtimeOwnerId: "runtime-1",
      runtimeLeaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await upsertLivestreamRequest(
      buildRequest({
        id: "queued-request",
        paymentConfirmedAt: new Date().toISOString(),
        signature: "paid-signature",
        sweepStatus: "swept",
        contractAddress: "So11111111111111111111111111111111111111112",
      }),
    );
    workerClientModule.dispatchSessionStart.mockResolvedValue({
      id: "public-session-paid",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: "So11111111111111111111111111111111111111112",
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "starting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await syncLivestreamQueue();

    expect(workerClientModule.dispatchSessionStop).toHaveBeenCalledWith(
      "public-session-existing",
    );
    expect(workerClientModule.dispatchSessionStart).toHaveBeenCalledWith({
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: "So11111111111111111111111111111111111111112",
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      mode: "live",
    });

    const saved = await getLivestreamRequest("queued-request");
    expect(saved?.status).toBe("active");
    expect(saved?.sessionId).toBe("public-session-paid");
  });

  it("serializes concurrent queue syncs so the public chartsync session only starts once", async () => {
    envModule.getServerEnv.mockReturnValue({
      ...envModule.getServerEnv(),
      PUBLIC_AUTOBLOW_DEVICE_TOKEN: "71nt0tdpv35q",
    });

    let resolveStart!: (value: {
      id: string;
      wallet: string;
      contractAddress: string;
      deviceId: string;
      deviceType: string;
      mode: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }) => void;
    const startPromise = new Promise<{
      id: string;
      wallet: string;
      contractAddress: string;
      deviceId: string;
      deviceType: string;
      mode: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>((resolve) => {
      resolveStart = resolve;
    });
    workerClientModule.dispatchSessionStart.mockReturnValue(startPromise);

    const syncs = [
      syncLivestreamQueue(),
      syncLivestreamQueue(),
      syncLivestreamQueue(),
    ];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (workerClientModule.dispatchSessionStart.mock.calls.length === 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(workerClientModule.dispatchSessionStart).toHaveBeenCalledTimes(1);

    resolveStart({
      id: "public-session-concurrent",
      wallet: PUBLIC_LIVESTREAM_OWNER_ID,
      contractAddress: DEFAULT_PUMP_TOKEN_MINT,
      deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
      deviceType: "autoblow",
      mode: "live",
      status: "starting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await Promise.all(syncs);

    expect(workerClientModule.dispatchSessionStart).toHaveBeenCalledTimes(1);
  });
});
