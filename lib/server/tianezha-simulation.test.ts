import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const envModule = vi.hoisted(() => ({
  getServerEnv: vi.fn(() => ({
    AGENT_MODEL_PROVIDER: "test",
    ALLOW_IN_PROCESS_WORKER: "false",
    APP_SESSION_SECRET: "",
    GOOGLE_GENAI_USE_VERTEXAI: "false",
    INTERNAL_ADMIN_LOGIN: "CamiKey",
    INTERNAL_ADMIN_PASSWORD: "",
    LIVESTREAM_PRIORITY_PRICE_SOL: "0.01",
    LIVESTREAM_SESSION_SECONDS: "120",
    LIVESTREAM_STANDARD_PRICE_SOL: "0.0069",
    NODE_ENV: "test",
    PUBLIC_AUTOBLOW_DEVICE_LABEL: "Test device",
    TIANSHI_AGENT_CONSTITUTION_PATH: "services/tianshi-automaton/constitution.md",
    TIANSHI_AGENT_RESERVE_FLOOR_SOL: "0.069420",
    TIANSHI_AGENT_WALLET_SECRET: "",
    TIANSHI_AUTONOMOUS_ENABLED: "true",
    TIANSHI_CONWAY_ALLOWED_HOSTS: "conway.tech",
    TIANSHI_CREATOR_FEES_WALLET: "creator-wallet",
    TIANSHI_GMGN_API_HOST: "https://gmgn.ai",
    TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT: "10",
    TIANSHI_OWNER_WALLET: "owner-wallet",
    TIANSHI_POLYMARKET_ALLOW_LIVE: "false",
    TIANSHI_POLYMARKET_CLOB_URL: "https://clob.polymarket.com",
    TIANSHI_POLYMARKET_DEFAULT_MODE: "read_only",
    TIANSHI_POLYMARKET_ENABLED: "false",
    TIANSHI_POLYMARKET_GAMMA_URL: "https://gamma-api.polymarket.com",
    TIANSHI_POLYMARKET_TOS_ACK: "false",
    TIANSHI_PUBLIC_TRACE_MODE: "maximum-available",
    TIANSHI_SETTLEMENT_INTERVAL_MINUTES: "1",
    TIANSHI_SKILLS_DIR: "services/tianshi-automaton/vendor",
    TIANSHI_TOKEN_MINT: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
    TIANSHI_X402_BUDGET_USD: "25.00",
    TIANSHI_X402_PER_HOUR_USD: "5.00",
    TIANSHI_X402_PER_REQUEST_USD: "1.00",
  })),
  isFirebaseConfigured: vi.fn(() => false),
  isProductionEnv: vi.fn(() => false),
}));

vi.mock("@/lib/env", () => envModule);

import { ensureHeartbeatSnapshot } from "@/lib/server/tianezha-simulation";

describe("ensureHeartbeatSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in test");
      }),
    );
    (
      globalThis as {
        __tianezhaSimulationStore?: unknown;
        __tianshiMemory?: unknown;
      }
    ).__tianezhaSimulationStore = undefined;
    (
      globalThis as {
        __tianezhaSimulationStore?: unknown;
        __tianshiMemory?: unknown;
      }
    ).__tianshiMemory = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not crash when reseeding a stale heartbeat after the Tianzi window closes", async () => {
    const snapshotTime = new Date("2026-03-26T10:09:00.000Z");
    vi.setSystemTime(snapshotTime);

    const snapshot = await ensureHeartbeatSnapshot(snapshotTime);

    vi.setSystemTime(new Date("2026-03-26T10:10:30.000Z"));

    await expect(ensureHeartbeatSnapshot(snapshotTime)).resolves.toMatchObject({
      id: snapshot.id,
    });
  });
});
