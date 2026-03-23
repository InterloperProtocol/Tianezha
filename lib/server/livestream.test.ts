import { beforeEach, describe, expect, it, vi } from "vitest";

const envModule = vi.hoisted(() => ({
  getPublicEnv: vi.fn(() => ({
    NEXT_PUBLIC_LIVESTREAM_EMBED_URL: "https://example.com/embed",
  })),
  getServerEnv: vi.fn(() => ({
    GOONCLAW_PAYMENT_SWEEP_SECRET: "test-sweep-secret",
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
vi.mock("@/lib/server/goonclaw-smart-wallets", () => smartWalletModule);
vi.mock("@/lib/server/worker-client", () => workerClientModule);
vi.mock("@/lib/server/solana", () => solanaModule);

import {
  getLivestreamState,
  verifyLivestreamRequestPayment,
} from "@/lib/server/livestream";
import {
  getLivestreamRequest,
  upsertLivestreamRequest,
} from "@/lib/server/repository";
import type { LivestreamRequestRecord } from "@/lib/types";

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
    (globalThis as { __goonclawMemory?: unknown }).__goonclawMemory = undefined;
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
});
