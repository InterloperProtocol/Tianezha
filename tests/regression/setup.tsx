import React from "react";

import { afterEach, beforeEach, vi } from "vitest";

declare global {
  var __testLoadedIdentityCookie:
    | {
        expiresAt: string;
        id: string;
        issuedAt: string;
        profileId: string;
      }
    | undefined;
  var __testPathname: string | undefined;
  var __testRouter: {
    prefetch: ReturnType<typeof vi.fn>;
    push: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
  };
}

const baseEnv = {
    AGENT_MODEL_PROVIDER: "test",
    ALLOW_IN_PROCESS_WORKER: "false",
    APP_SESSION_SECRET: "test-session-secret",
    BNB_RPC_URL: "https://bnb.invalid",
    GOOGLE_GENAI_USE_VERTEXAI: "false",
    INTERNAL_ADMIN_LOGIN: "CamiKey",
    INTERNAL_ADMIN_PASSWORD: "",
    LIVESTREAM_PRIORITY_PRICE_SOL: "0.01",
    LIVESTREAM_SESSION_SECONDS: "120",
    LIVESTREAM_STANDARD_PRICE_SOL: "0.0069",
    NODE_ENV: "test",
    PUBLIC_AUTOBLOW_DEVICE_LABEL: "Test device",
    SOLANA_RPC_URL: "https://solana.invalid",
    TIANEZHA_BNB_TOKEN_ADDRESS: "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810abc",
    TIANEZHA_BNB_VERIFICATION_ADDRESS: "0x8f31a56bc0d4f1ed90aa5d79f501ab3419810def",
    TIANEZHA_DATA_NAMESPACE: "testnet",
    TIANEZHA_FIRESTORE_ROOT_COLLECTION: "tianezhaEnvironments",
    TIANEZHA_SOL_TOKEN_ADDRESS: "So11111111111111111111111111111111111111112",
    TIANEZHA_SOL_VERIFICATION_ADDRESS: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    TIANSHI_AGENT_CONSTITUTION_PATH: "services/tianshi-automaton/constitution.md",
    TIANSHI_AGENT_RESERVE_FLOOR_SOL: "0.069420",
    TIANSHI_AGENT_WALLET_SECRET: "",
    TIANSHI_AUTONOMOUS_ENABLED: "true",
    TIANSHI_CONWAY_ALLOWED_HOSTS: "conway.tech",
    TIANSHI_CREATOR_FEES_WALLET: "creator-wallet",
    TIANSHI_DEXTER_PATH: ".",
    TIANSHI_GMGN_API_KEY: "",
    TIANSHI_GMGN_API_HOST: "https://gmgn.ai",
    TIANSHI_GMGN_API_SECRET: "",
    TIANSHI_HYPERLIQUID_API_URL: "https://api.hyperliquid.invalid",
    TIANSHI_HYPERLIQUID_API_WALLET: "",
    TIANSHI_HYPERLIQUID_API_WALLET_SECRET: "",
    TIANSHI_HYPERLIQUID_DEFAULT_DEX: "",
    TIANSHI_HYPERLIQUID_MASTER_WALLET: "",
    TIANSHI_HYPERLIQUID_WS_URL: "wss://hyperliquid.invalid/ws",
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
    TREASURY_WALLET: "8PnTestTreasury1111111111111111111111111111111",
} as const;

const envModule = {
  getServerEnv: vi.fn(
    () =>
      new Proxy(baseEnv, {
        get(target, prop) {
          if (typeof prop === "string" && !(prop in target)) {
            return "";
          }
          return target[prop as keyof typeof target];
        },
      }),
  ),
  isFirebaseConfigured: vi.fn(() => false),
  isProductionEnv: vi.fn(() => false),
};

vi.mock("@/lib/env", () => envModule);

vi.mock("@/lib/server/loaded-identity", () => ({
  getLoadedIdentityCookie: vi.fn(async () => globalThis.__testLoadedIdentityCookie ?? null),
  setLoadedIdentityCookie: vi.fn(async (profileId: string) => {
    const session = {
      expiresAt: new Date("2026-04-03T12:00:00.000Z").toISOString(),
      id: "loaded-test-session",
      issuedAt: new Date("2026-03-27T12:00:00.000Z").toISOString(),
      profileId,
    };
    globalThis.__testLoadedIdentityCookie = session;
    return session;
  }),
}));

vi.mock("next/link", () => ({
  default: function MockLink(props: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    const { children, href, ...rest } = props;
    return React.createElement("a", { href, ...rest }, children);
  },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  usePathname: () => globalThis.__testPathname ?? "/",
  useRouter: () => globalThis.__testRouter,
}));

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-27T12:00:00.000Z"));
  process.env.TIANEZHA_BNB_TOKEN_ADDRESS = baseEnv.TIANEZHA_BNB_TOKEN_ADDRESS;
  process.env.TIANEZHA_BNB_VERIFICATION_ADDRESS = baseEnv.TIANEZHA_BNB_VERIFICATION_ADDRESS;
  process.env.TIANEZHA_DATA_NAMESPACE = baseEnv.TIANEZHA_DATA_NAMESPACE;
  process.env.TIANEZHA_FIRESTORE_ROOT_COLLECTION = baseEnv.TIANEZHA_FIRESTORE_ROOT_COLLECTION;
  process.env.TIANEZHA_SOL_TOKEN_ADDRESS = baseEnv.TIANEZHA_SOL_TOKEN_ADDRESS;
  process.env.TIANEZHA_SOL_VERIFICATION_ADDRESS = baseEnv.TIANEZHA_SOL_VERIFICATION_ADDRESS;
  globalThis.__testLoadedIdentityCookie = undefined;
  globalThis.__testPathname = "/";
  globalThis.__testRouter = {
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  };
  globalThis.__tianezhaSimulationStore = undefined;
  globalThis.__tianshiMemory = undefined;
  const [{ resetMeshCommerceState }, { resetTianshiRuntimeControl }] = await Promise.all([
    import("@/lib/server/mesh-commerce"),
    import("@/lib/server/tianshi-runtime-control"),
  ]);
  resetMeshCommerceState();
  resetTianshiRuntimeControl();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network disabled in test");
    }),
  );
});

afterEach(() => {
  delete process.env.TIANEZHA_BNB_TOKEN_ADDRESS;
  delete process.env.TIANEZHA_BNB_VERIFICATION_ADDRESS;
  delete process.env.TIANEZHA_DATA_NAMESPACE;
  delete process.env.TIANEZHA_FIRESTORE_ROOT_COLLECTION;
  delete process.env.TIANEZHA_SOL_TOKEN_ADDRESS;
  delete process.env.TIANEZHA_SOL_VERIFICATION_ADDRESS;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});
