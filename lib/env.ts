import { z } from "zod";

import { CONSTITUTION } from "@/lib/constitution";
import {
  getNamespacedFilePath,
  resolveTianezhaDataNamespace,
  resolveTianezhaFirestoreRootCollection,
} from "@/lib/server/data-namespace";
import {
  DEFAULT_ACCESS_TOKEN_SYMBOL,
  DEFAULT_PUMP_TOKEN_MINT,
} from "@/lib/token-defaults";

const rawServerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_SESSION_SECRET: z.string().optional(),
  DEVICE_CREDENTIALS_AES_KEY: z.string().optional(),
  PAYLOAD_SECRET: z.string().optional(),
  PAYLOAD_DATABASE_URL: z.string().optional(),
  TIANEZHA_DATA_NAMESPACE: z.string().optional(),
  TIANEZHA_FIRESTORE_ROOT_COLLECTION: z.string().optional(),
  TIANEZHA_ALLOWED_MUTATION_ORIGINS: z.string().optional(),
  INTERNAL_ADMIN_LOGIN: z.string().optional(),
  INTERNAL_ADMIN_PASSWORD: z.string().optional(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]).optional(),
  SOLANA_RPC_URL: z.string().optional(),
  BNB_RPC_URL: z.string().optional(),
  TREASURY_WALLET: z.string().optional(),
  ACCESS_CNFT_PRICE_SOL: z.string().optional(),
  ACCESS_CNFT_NAME: z.string().optional(),
  ACCESS_CNFT_METADATA_URI: z.string().optional(),
  ACCESS_CNFT_COLLECTION: z.string().optional(),
  ACCESS_CNFT_TREE: z.string().optional(),
  ACCESS_CNFT_AUTHORITY_SECRET: z.string().optional(),
  TIANSHI_TOKEN_MINT: z.string().optional(),
  TIANSHI_OWNER_WALLET: z.string().optional(),
  TIANSHI_CREATOR_FEES_WALLET: z.string().optional(),
  TIANSHI_AGENT_WALLET_SECRET: z.string().optional(),
  TIANSHI_PAYMENT_SWEEP_SECRET: z.string().optional(),
  TIANSHI_AGENT_RESERVE_FLOOR_SOL: z.string().optional(),
  TIANSHI_SETTLEMENT_INTERVAL_MINUTES: z.string().optional(),
  TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT: z.string().optional(),
  TIANSHI_AUTONOMOUS_ENABLED: z.string().optional(),
  TIANSHI_PUBLIC_TRACE_MODE: z.string().optional(),
  TIANSHI_SKILLS_DIR: z.string().optional(),
  TIANSHI_AGENT_CONSTITUTION_PATH: z.string().optional(),
  TIANSHI_CONWAY_ALLOWED_HOSTS: z.string().optional(),
  CONWAY_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  CONTEXT7_API_KEY: z.string().optional(),
  TIANSHI_BURN_AMOUNT_RAW: z.string().optional(),
  TIANSHI_TOKEN_DECIMALS: z.string().optional(),
  BAGSTROKE_TOKEN_MINT: z.string().optional(),
  BAGSTROKE_BURN_AMOUNT_RAW: z.string().optional(),
  BAGSTROKE_TOKEN_DECIMALS: z.string().optional(),
  LAUNCHONOMICS_TOKEN_MINT: z.string().optional(),
  LAUNCHONOMICS_LAUNCH_AT: z.string().optional(),
  HELIUS_API_KEY: z.string().optional(),
  BIRDEYE_API_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  AGENT_MODEL_PROVIDER: z.string().optional(),
  GOOGLE_GENAI_USE_VERTEXAI: z.string().optional(),
  VERTEX_AI_PROJECT_ID: z.string().optional(),
  VERTEX_AI_LOCATION: z.string().optional(),
  VERTEX_AI_MODEL: z.string().optional(),
  WORKER_URL: z.string().optional(),
  WORKER_TOKEN: z.string().optional(),
  ALLOW_IN_PROCESS_WORKER: z.string().optional(),
  PUBLIC_AUTOBLOW_DEVICE_TOKEN: z.string().optional(),
  PUBLIC_AUTOBLOW_DEVICE_LABEL: z.string().optional(),
  TIANSHI_TELEGRAM_BOT_TOKEN: z.string().optional(),
  TIANSHI_TELEGRAM_CHAT_ID: z.string().optional(),
  TIANSHI_TELEGRAM_THREAD_ID: z.string().optional(),
  TIANSHI_TELEGRAM_DESCRIPTION: z.string().optional(),
  TIANSHI_TELEGRAM_SHORT_DESCRIPTION: z.string().optional(),
  TIANSHI_PARENT_BRAIN_KEY_START: z.string().optional(),
  TIANSHI_PARENT_BRAIN_KEY_END: z.string().optional(),
  TIANSHI_PARENT_BRAIN_SIGNATURE: z.string().optional(),
  TIANSHI_WECHAT_WEBHOOK_URL: z.string().optional(),
  TIANSHI_WECHAT_BOT_NAME: z.string().optional(),
  TIANSHI_WECHAT_CHANNEL_LABEL: z.string().optional(),
  TIANSHI_RISK_RISK_PER_TRADE_PCT: z.string().optional(),
  TIANSHI_RISK_KELLY_CLIP_MULTIPLIER: z.string().optional(),
  TIANSHI_RISK_POSITION_HARD_CAP_PCT: z.string().optional(),
  TIANSHI_RISK_MIN_TOP_OF_BOOK_DEPTH_USD: z.string().optional(),
  TIANSHI_RISK_MIN_FIVE_MINUTE_VOLUME_USD: z.string().optional(),
  TIANSHI_RISK_MAX_SPREAD_BPS: z.string().optional(),
  TIANSHI_RISK_FREEZE_AFTER_RED_TRADES: z.string().optional(),
  TIANSHI_RISK_MIN_SAMPLE_TRADES_BEFORE_CHANGE: z.string().optional(),
  TIANSHI_RISK_SAME_DAY_LIVE_PARAM_CHANGES: z.string().optional(),
  TIANSHI_GMGN_API_KEY: z.string().optional(),
  TIANSHI_GMGN_AUTH_PRIVATE_KEY: z.string().optional(),
  TIANSHI_GMGN_TRADING_WALLET: z.string().optional(),
  TIANSHI_GMGN_TRADING_SECRET: z.string().optional(),
  TIANSHI_GMGN_API_HOST: z.string().optional(),
  LIVESTREAM_STANDARD_PRICE_SOL: z.string().optional(),
  LIVESTREAM_PRIORITY_PRICE_SOL: z.string().optional(),
  LIVESTREAM_SESSION_SECONDS: z.string().optional(),
  LIVESTREAM_REQUESTER_COOLDOWN_SECONDS: z.string().optional(),
  LIVESTREAM_CONTRACT_COOLDOWN_SECONDS: z.string().optional(),
  LIVESTREAM_MAX_QUEUE_LENGTH: z.string().optional(),
  TIANSHI_X402_BUDGET_USD: z.string().optional(),
  TIANSHI_X402_PER_REQUEST_USD: z.string().optional(),
  TIANSHI_X402_PER_HOUR_USD: z.string().optional(),
  TIANSHI_X402_ALLOWED_DOMAINS: z.string().optional(),
  TIANSHI_DEXTER_ENABLED: z.string().optional(),
  TIANSHI_DEXTER_PATH: z.string().optional(),
  TIANSHI_DEXTER_PYTHON_BIN: z.string().optional(),
  TIANSHI_DEXTER_DATABASE_URL: z.string().optional(),
  TIANSHI_DEXTER_HTTP_URL: z.string().optional(),
  TIANSHI_DEXTER_WS_URL: z.string().optional(),
  TIANSHI_DEXTER_NETWORK: z.string().optional(),
  TIANSHI_DEXTER_DEFAULT_MODE: z.string().optional(),
  TIANSHI_DEXTER_ALLOW_LIVE: z.string().optional(),
  TIANSHI_DEXTER_MAINNET_DRY_RUN: z.string().optional(),
  TIANSHI_GODMODE_ENABLED: z.string().optional(),
  TIANSHI_GODMODE_API_URL: z.string().optional(),
  TIANSHI_GODMODE_API_KEY: z.string().optional(),
  TIANSHI_GODMODE_OPENROUTER_KEY: z.string().optional(),
  TIANSHI_GODMODE_DEFAULT_MODEL: z.string().optional(),
  TIANSHI_AGFUND_ENABLED: z.string().optional(),
  TIANSHI_AGFUND_API_URL: z.string().optional(),
  TIANSHI_AGFUND_API_KEY: z.string().optional(),
  TIANSHI_AGFUND_MARKETPLACE_URL: z.string().optional(),
  TIANSHI_FOURMEME_ENABLED: z.string().optional(),
  TIANSHI_FOURMEME_AGENTIC_URL: z.string().optional(),
  TIANSHI_HYPERLIQUID_ENABLED: z.string().optional(),
  TIANSHI_HYPERLIQUID_API_URL: z.string().optional(),
  TIANSHI_HYPERLIQUID_WS_URL: z.string().optional(),
  TIANSHI_HYPERLIQUID_MASTER_WALLET: z.string().optional(),
  TIANSHI_HYPERLIQUID_API_WALLET: z.string().optional(),
  TIANSHI_HYPERLIQUID_API_WALLET_SECRET: z.string().optional(),
  TIANSHI_HYPERLIQUID_DEFAULT_DEX: z.string().optional(),
  TIANSHI_HYPERLIQUID_ALLOW_LIVE: z.string().optional(),
  TIANSHI_POLYMARKET_ENABLED: z.string().optional(),
  TIANSHI_POLYMARKET_GAMMA_URL: z.string().optional(),
  TIANSHI_POLYMARKET_CLOB_URL: z.string().optional(),
  TIANSHI_POLYMARKET_DEFAULT_MODE: z.string().optional(),
  TIANSHI_POLYMARKET_ALLOW_LIVE: z.string().optional(),
  TIANSHI_POLYMARKET_TOS_ACK: z.string().optional(),
  TIANSHI_REPORT_COMMERCE_ENABLED: z.string().optional(),
  TIANSHI_REPORT_PRICE_USDC: z.string().optional(),
  TIANSHI_REPORT_BUY_WINDOW_SECONDS: z.string().optional(),
  TIANSHI_REPORT_TRADE_DELAY_SECONDS: z.string().optional(),
  TIANSHI_KNOWLEDGE_SALES_ENABLED: z.string().optional(),
  YT_DLP_COOKIES_PATH: z.string().optional(),
  YT_DLP_COOKIES_FROM_BROWSER: z.string().optional(),
});

const resolvedServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  APP_SESSION_SECRET: z.string().min(1),
  DEVICE_CREDENTIALS_AES_KEY: z.string().min(1),
  PAYLOAD_SECRET: z.string().min(1),
  PAYLOAD_DATABASE_URL: z.string().min(1),
  TIANEZHA_DATA_NAMESPACE: z.string().min(1),
  TIANEZHA_FIRESTORE_ROOT_COLLECTION: z.string().min(1),
  TIANEZHA_ALLOWED_MUTATION_ORIGINS: z.string(),
  INTERNAL_ADMIN_LOGIN: z.string().min(1),
  INTERNAL_ADMIN_PASSWORD: z.string(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]),
  SOLANA_RPC_URL: z.string().min(1),
  BNB_RPC_URL: z.string().min(1),
  TREASURY_WALLET: z.string().min(1),
  ACCESS_CNFT_PRICE_SOL: z.string().min(1),
  ACCESS_CNFT_NAME: z.string().min(1),
  ACCESS_CNFT_METADATA_URI: z.string().min(1),
  ACCESS_CNFT_COLLECTION: z.string(),
  ACCESS_CNFT_TREE: z.string(),
  ACCESS_CNFT_AUTHORITY_SECRET: z.string(),
  BAGSTROKE_TOKEN_MINT: z.string(),
  TIANSHI_OWNER_WALLET: z.string().min(1),
  TIANSHI_CREATOR_FEES_WALLET: z.string().min(1),
  TIANSHI_AGENT_WALLET_SECRET: z.string(),
  TIANSHI_PAYMENT_SWEEP_SECRET: z.string(),
  TIANSHI_AGENT_RESERVE_FLOOR_SOL: z.string().min(1),
  TIANSHI_SETTLEMENT_INTERVAL_MINUTES: z.string().min(1),
  TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT: z.string().min(1),
  TIANSHI_AUTONOMOUS_ENABLED: z.enum(["true", "false"]),
  TIANSHI_PUBLIC_TRACE_MODE: z.string().min(1),
  TIANSHI_SKILLS_DIR: z.string().min(1),
  TIANSHI_AGENT_CONSTITUTION_PATH: z.string().min(1),
  TIANSHI_CONWAY_ALLOWED_HOSTS: z.string().min(1),
  CONWAY_API_KEY: z.string(),
  TAVILY_API_KEY: z.string(),
  CONTEXT7_API_KEY: z.string(),
  BAGSTROKE_BURN_AMOUNT_RAW: z.string().min(1),
  BAGSTROKE_TOKEN_DECIMALS: z.string().min(1),
  LAUNCHONOMICS_TOKEN_MINT: z.string(),
  LAUNCHONOMICS_LAUNCH_AT: z.string(),
  HELIUS_API_KEY: z.string(),
  BIRDEYE_API_KEY: z.string(),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),
  FIREBASE_STORAGE_BUCKET: z.string(),
  AGENT_MODEL_PROVIDER: z.string().min(1),
  GOOGLE_GENAI_USE_VERTEXAI: z.enum(["true", "false"]),
  VERTEX_AI_PROJECT_ID: z.string(),
  VERTEX_AI_LOCATION: z.string().min(1),
  VERTEX_AI_MODEL: z.string().min(1),
  WORKER_URL: z.string(),
  WORKER_TOKEN: z.string().min(1),
  ALLOW_IN_PROCESS_WORKER: z.enum(["true", "false"]),
  PUBLIC_AUTOBLOW_DEVICE_TOKEN: z.string(),
  PUBLIC_AUTOBLOW_DEVICE_LABEL: z.string().min(1),
  TIANSHI_TELEGRAM_BOT_TOKEN: z.string(),
  TIANSHI_TELEGRAM_CHAT_ID: z.string(),
  TIANSHI_TELEGRAM_THREAD_ID: z.string(),
  TIANSHI_TELEGRAM_DESCRIPTION: z.string(),
  TIANSHI_TELEGRAM_SHORT_DESCRIPTION: z.string(),
  TIANSHI_PARENT_BRAIN_KEY_START: z.string(),
  TIANSHI_PARENT_BRAIN_KEY_END: z.string(),
  TIANSHI_PARENT_BRAIN_SIGNATURE: z.string(),
  TIANSHI_WECHAT_WEBHOOK_URL: z.string(),
  TIANSHI_WECHAT_BOT_NAME: z.string(),
  TIANSHI_WECHAT_CHANNEL_LABEL: z.string(),
  TIANSHI_RISK_RISK_PER_TRADE_PCT: z.string().min(1),
  TIANSHI_RISK_KELLY_CLIP_MULTIPLIER: z.string().min(1),
  TIANSHI_RISK_POSITION_HARD_CAP_PCT: z.string().min(1),
  TIANSHI_RISK_MIN_TOP_OF_BOOK_DEPTH_USD: z.string().min(1),
  TIANSHI_RISK_MIN_FIVE_MINUTE_VOLUME_USD: z.string().min(1),
  TIANSHI_RISK_MAX_SPREAD_BPS: z.string().min(1),
  TIANSHI_RISK_FREEZE_AFTER_RED_TRADES: z.string().min(1),
  TIANSHI_RISK_MIN_SAMPLE_TRADES_BEFORE_CHANGE: z.string().min(1),
  TIANSHI_RISK_SAME_DAY_LIVE_PARAM_CHANGES: z.enum(["true", "false"]),
  TIANSHI_GMGN_API_KEY: z.string(),
  TIANSHI_GMGN_AUTH_PRIVATE_KEY: z.string(),
  TIANSHI_GMGN_TRADING_WALLET: z.string(),
  TIANSHI_GMGN_TRADING_SECRET: z.string(),
  TIANSHI_GMGN_API_HOST: z.string().min(1),
  LIVESTREAM_STANDARD_PRICE_SOL: z.string().min(1),
  LIVESTREAM_PRIORITY_PRICE_SOL: z.string().min(1),
  LIVESTREAM_SESSION_SECONDS: z.string().min(1),
  LIVESTREAM_REQUESTER_COOLDOWN_SECONDS: z.string().min(1),
  LIVESTREAM_CONTRACT_COOLDOWN_SECONDS: z.string().min(1),
  LIVESTREAM_MAX_QUEUE_LENGTH: z.string().min(1),
  TIANSHI_X402_BUDGET_USD: z.string().min(1),
  TIANSHI_X402_PER_REQUEST_USD: z.string().min(1),
  TIANSHI_X402_PER_HOUR_USD: z.string().min(1),
  TIANSHI_X402_ALLOWED_DOMAINS: z.string(),
  TIANSHI_DEXTER_ENABLED: z.enum(["true", "false"]),
  TIANSHI_DEXTER_PATH: z.string().min(1),
  TIANSHI_DEXTER_PYTHON_BIN: z.string(),
  TIANSHI_DEXTER_DATABASE_URL: z.string(),
  TIANSHI_DEXTER_HTTP_URL: z.string(),
  TIANSHI_DEXTER_WS_URL: z.string(),
  TIANSHI_DEXTER_NETWORK: z.enum(["devnet", "mainnet"]),
  TIANSHI_DEXTER_DEFAULT_MODE: z.enum(["read_only", "paper", "simulate", "live"]),
  TIANSHI_DEXTER_ALLOW_LIVE: z.enum(["true", "false"]),
  TIANSHI_DEXTER_MAINNET_DRY_RUN: z.enum(["true", "false"]),
  TIANSHI_GODMODE_ENABLED: z.enum(["true", "false"]),
  TIANSHI_GODMODE_API_URL: z.string(),
  TIANSHI_GODMODE_API_KEY: z.string(),
  TIANSHI_GODMODE_OPENROUTER_KEY: z.string(),
  TIANSHI_GODMODE_DEFAULT_MODEL: z.string().min(1),
  TIANSHI_AGFUND_ENABLED: z.enum(["true", "false"]),
  TIANSHI_AGFUND_API_URL: z.string().min(1),
  TIANSHI_AGFUND_API_KEY: z.string(),
  TIANSHI_AGFUND_MARKETPLACE_URL: z.string().min(1),
  TIANSHI_FOURMEME_ENABLED: z.enum(["true", "false"]),
  TIANSHI_FOURMEME_AGENTIC_URL: z.string().min(1),
  TIANSHI_HYPERLIQUID_ENABLED: z.enum(["true", "false"]),
  TIANSHI_HYPERLIQUID_API_URL: z.string().min(1),
  TIANSHI_HYPERLIQUID_WS_URL: z.string().min(1),
  TIANSHI_HYPERLIQUID_MASTER_WALLET: z.string(),
  TIANSHI_HYPERLIQUID_API_WALLET: z.string(),
  TIANSHI_HYPERLIQUID_API_WALLET_SECRET: z.string(),
  TIANSHI_HYPERLIQUID_DEFAULT_DEX: z.string(),
  TIANSHI_HYPERLIQUID_ALLOW_LIVE: z.enum(["true", "false"]),
  TIANSHI_POLYMARKET_ENABLED: z.enum(["true", "false"]),
  TIANSHI_POLYMARKET_GAMMA_URL: z.string().min(1),
  TIANSHI_POLYMARKET_CLOB_URL: z.string().min(1),
  TIANSHI_POLYMARKET_DEFAULT_MODE: z.enum(["read_only", "paper", "live"]),
  TIANSHI_POLYMARKET_ALLOW_LIVE: z.enum(["true", "false"]),
  TIANSHI_POLYMARKET_TOS_ACK: z.enum(["true", "false"]),
  TIANSHI_REPORT_COMMERCE_ENABLED: z.enum(["true", "false"]),
  TIANSHI_REPORT_PRICE_USDC: z.string().min(1),
  TIANSHI_REPORT_BUY_WINDOW_SECONDS: z.string().min(1),
  TIANSHI_REPORT_TRADE_DELAY_SECONDS: z.string().min(1),
  TIANSHI_KNOWLEDGE_SALES_ENABLED: z.enum(["true", "false"]),
  YT_DLP_COOKIES_PATH: z.string(),
  YT_DLP_COOKIES_FROM_BROWSER: z.string(),
});

const rawPublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().optional(),
  NEXT_PUBLIC_SOLANA_NETWORK: z
    .enum(["devnet", "mainnet-beta"])
    .optional(),
  NEXT_PUBLIC_TREASURY_WALLET: z.string().optional(),
  NEXT_PUBLIC_ACCESS_CNFT_PRICE_SOL: z.string().optional(),
  NEXT_PUBLIC_TIANSHI_TOKEN_MINT: z.string().optional(),
  NEXT_PUBLIC_TIANSHI_BURN_AMOUNT_RAW: z.string().optional(),
  NEXT_PUBLIC_TIANSHI_TOKEN_DECIMALS: z.string().optional(),
  NEXT_PUBLIC_BAGSTROKE_TOKEN_MINT: z.string().optional(),
  NEXT_PUBLIC_BAGSTROKE_BURN_AMOUNT_RAW: z.string().optional(),
  NEXT_PUBLIC_BAGSTROKE_TOKEN_DECIMALS: z.string().optional(),
  NEXT_PUBLIC_FREE_ACCESS_UNTIL: z.string().optional(),
  NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL: z.string().optional(),
  NEXT_PUBLIC_LAUNCHONOMICS_LAUNCH_AT: z.string().optional(),
  NEXT_PUBLIC_TIANSHI_MEDIA_URL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_EMBED_URL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_STANDARD_PRICE_SOL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_PRIORITY_PRICE_SOL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_SESSION_SECONDS: z.string().optional(),
});

const DEFAULT_TIANSHI_STREAM_URL = "https://www.youtube.com/watch?v=e5nyQmaq4k4";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().min(1),
  NEXT_PUBLIC_SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]),
  NEXT_PUBLIC_TREASURY_WALLET: z.string().min(1),
  NEXT_PUBLIC_ACCESS_CNFT_PRICE_SOL: z.string().min(1),
  NEXT_PUBLIC_BAGSTROKE_TOKEN_MINT: z.string(),
  NEXT_PUBLIC_BAGSTROKE_BURN_AMOUNT_RAW: z.string().min(1),
  NEXT_PUBLIC_BAGSTROKE_TOKEN_DECIMALS: z.string().min(1),
  NEXT_PUBLIC_FREE_ACCESS_UNTIL: z.string().min(1),
  NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL: z.string().min(1),
  NEXT_PUBLIC_LAUNCHONOMICS_LAUNCH_AT: z.string(),
  NEXT_PUBLIC_TIANSHI_MEDIA_URL: z.string(),
  NEXT_PUBLIC_LIVESTREAM_EMBED_URL: z.string(),
  NEXT_PUBLIC_LIVESTREAM_STANDARD_PRICE_SOL: z.string().min(1),
  NEXT_PUBLIC_LIVESTREAM_PRIORITY_PRICE_SOL: z.string().min(1),
  NEXT_PUBLIC_LIVESTREAM_SESSION_SECONDS: z.string().min(1),
});

export type ServerEnv = z.infer<typeof resolvedServerEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

function resolveValue(
  value: string | undefined,
  fallback: string,
  isProduction: boolean,
  name: string,
  minimumLength = 1,
) {
  const resolved = value?.trim() || (!isProduction ? fallback : "");
  if (resolved.length < minimumLength) {
    throw new Error(`${name} must be configured`);
  }
  return resolved;
}

function hasFirebaseCredentials(env: {
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
}) {
  return Boolean(
    env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY,
  );
}

function inferLaunchAtFromFreeUntil(value: string | undefined) {
  if (!value?.trim()) return "";

  const freeUntil = new Date(value);
  if (Number.isNaN(freeUntil.getTime())) {
    return "";
  }

  return new Date(freeUntil.getTime() - 24 * 60 * 60_000).toISOString();
}

function inferProjectIdFromFirebaseConfig(value: string | undefined) {
  if (!value?.trim()) return "";

  try {
    const parsed = JSON.parse(value) as { projectId?: string };
    return parsed.projectId?.trim() || "";
  } catch {
    return "";
  }
}

function resolveServerEnv(raw: z.infer<typeof rawServerEnvSchema>) {
  const isProduction = raw.NODE_ENV === "production";
  const defaultPayloadDatabasePath = isProduction
    ? "/tmp/tianshi-payload.db"
    : "./.data/tianshi-payload.db";
  const dataNamespace = resolveTianezhaDataNamespace(
    raw.TIANEZHA_DATA_NAMESPACE,
    raw.NODE_ENV,
  );
  const firestoreRootCollection = resolveTianezhaFirestoreRootCollection(
    raw.TIANEZHA_FIRESTORE_ROOT_COLLECTION,
  );
  const allowInProcessWorker =
    raw.ALLOW_IN_PROCESS_WORKER ?? (isProduction ? "false" : "true");
  const firebaseConfigProjectId = inferProjectIdFromFirebaseConfig(
    process.env.FIREBASE_CONFIG,
  );

  if (
    isProduction &&
    !process.env.FIREBASE_CONFIG &&
    !hasFirebaseCredentials(raw)
  ) {
    throw new Error(
      "Firebase Admin credentials must be configured in production",
    );
  }

  if (
    isProduction &&
    allowInProcessWorker !== "true" &&
    !(raw.WORKER_URL?.trim() || "")
  ) {
    throw new Error(
      "WORKER_URL must be configured in production when ALLOW_IN_PROCESS_WORKER is false",
    );
  }

  return resolvedServerEnvSchema.parse({
    NODE_ENV: raw.NODE_ENV,
    APP_SESSION_SECRET: resolveValue(
      raw.APP_SESSION_SECRET,
      "tianshi-dev-session-secret",
      isProduction,
      "APP_SESSION_SECRET",
      16,
    ),
    DEVICE_CREDENTIALS_AES_KEY: resolveValue(
      raw.DEVICE_CREDENTIALS_AES_KEY,
      "tianshi-dev-device-key",
      isProduction,
      "DEVICE_CREDENTIALS_AES_KEY",
      16,
    ),
    PAYLOAD_SECRET: resolveValue(
      raw.PAYLOAD_SECRET?.trim() || raw.APP_SESSION_SECRET?.trim(),
      "tianshi-dev-payload-secret",
      isProduction,
      "PAYLOAD_SECRET",
      16,
    ),
    PAYLOAD_DATABASE_URL: (() => {
      const configuredUrl = raw.PAYLOAD_DATABASE_URL?.trim();
      if (!configuredUrl) {
        return `file:${getNamespacedFilePath(
          defaultPayloadDatabasePath,
          dataNamespace,
        )}`;
      }

      if (!configuredUrl.startsWith("file:")) {
        return configuredUrl;
      }

      const filePath = configuredUrl.slice("file:".length) || defaultPayloadDatabasePath;
      return `file:${getNamespacedFilePath(filePath, dataNamespace)}`;
    })(),
    TIANEZHA_DATA_NAMESPACE: dataNamespace,
    TIANEZHA_FIRESTORE_ROOT_COLLECTION: firestoreRootCollection,
    TIANEZHA_ALLOWED_MUTATION_ORIGINS:
      raw.TIANEZHA_ALLOWED_MUTATION_ORIGINS?.trim() || "",
    INTERNAL_ADMIN_LOGIN: raw.INTERNAL_ADMIN_LOGIN?.trim() || "admin",
    INTERNAL_ADMIN_PASSWORD: raw.INTERNAL_ADMIN_PASSWORD?.trim() || "",
    SOLANA_NETWORK: raw.SOLANA_NETWORK ?? "mainnet-beta",
    SOLANA_RPC_URL:
      raw.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com",
    BNB_RPC_URL:
      raw.BNB_RPC_URL?.trim() || "https://bsc-dataseed.bnbchain.org",
    TREASURY_WALLET:
      raw.TREASURY_WALLET?.trim() ||
      "HQhD7ZRMp4jv2NFdN26nJ5NCWySQD6nQM9KoG5doapDi",
    ACCESS_CNFT_PRICE_SOL: raw.ACCESS_CNFT_PRICE_SOL?.trim() || "0.25",
    ACCESS_CNFT_NAME:
      raw.ACCESS_CNFT_NAME?.trim() || "Tianshi Access Pass",
    ACCESS_CNFT_METADATA_URI:
      raw.ACCESS_CNFT_METADATA_URI?.trim() ||
      "https://example.com/tianshi-access.json",
    ACCESS_CNFT_COLLECTION: raw.ACCESS_CNFT_COLLECTION?.trim() || "",
    ACCESS_CNFT_TREE: raw.ACCESS_CNFT_TREE?.trim() || "",
    ACCESS_CNFT_AUTHORITY_SECRET:
      raw.ACCESS_CNFT_AUTHORITY_SECRET?.trim() || "",
    BAGSTROKE_TOKEN_MINT:
      raw.TIANSHI_TOKEN_MINT?.trim() ||
      raw.BAGSTROKE_TOKEN_MINT?.trim() ||
      DEFAULT_PUMP_TOKEN_MINT,
    TIANSHI_OWNER_WALLET:
      raw.TIANSHI_OWNER_WALLET?.trim() ||
      raw.TREASURY_WALLET?.trim() ||
      "HQhD7ZRMp4jv2NFdN26nJ5NCWySQD6nQM9KoG5doapDi",
    TIANSHI_CREATOR_FEES_WALLET:
      raw.TIANSHI_CREATOR_FEES_WALLET?.trim() ||
      raw.TIANSHI_OWNER_WALLET?.trim() ||
      raw.TREASURY_WALLET?.trim() ||
      "HQhD7ZRMp4jv2NFdN26nJ5NCWySQD6nQM9KoG5doapDi",
    TIANSHI_AGENT_WALLET_SECRET:
      raw.TIANSHI_AGENT_WALLET_SECRET?.trim() || "",
    TIANSHI_PAYMENT_SWEEP_SECRET:
      raw.TIANSHI_PAYMENT_SWEEP_SECRET?.trim() ||
      raw.TIANSHI_AGENT_WALLET_SECRET?.trim() ||
      "",
    TIANSHI_AGENT_RESERVE_FLOOR_SOL:
      raw.TIANSHI_AGENT_RESERVE_FLOOR_SOL?.trim() ||
      CONSTITUTION.reservePolicy.reserveFloorSol,
    TIANSHI_SETTLEMENT_INTERVAL_MINUTES:
      raw.TIANSHI_SETTLEMENT_INTERVAL_MINUTES?.trim() || "15",
    TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT:
      raw.TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT?.trim() || "10",
    TIANSHI_AUTONOMOUS_ENABLED:
      raw.TIANSHI_AUTONOMOUS_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_PUBLIC_TRACE_MODE:
      raw.TIANSHI_PUBLIC_TRACE_MODE?.trim() || "maximum-available",
    TIANSHI_SKILLS_DIR:
      raw.TIANSHI_SKILLS_DIR?.trim() ||
      "services/tianshi-automaton/vendor",
    TIANSHI_AGENT_CONSTITUTION_PATH:
      raw.TIANSHI_AGENT_CONSTITUTION_PATH?.trim() ||
      "docs/CONSTITUTION.md",
    TIANSHI_CONWAY_ALLOWED_HOSTS:
      raw.TIANSHI_CONWAY_ALLOWED_HOSTS?.trim() ||
      "conway.tech,*.conway.tech,conway.ai,*.conway.ai",
    CONWAY_API_KEY: raw.CONWAY_API_KEY?.trim() || "",
    TAVILY_API_KEY: raw.TAVILY_API_KEY?.trim() || "",
    CONTEXT7_API_KEY: raw.CONTEXT7_API_KEY?.trim() || "",
    BAGSTROKE_BURN_AMOUNT_RAW:
      raw.TIANSHI_BURN_AMOUNT_RAW?.trim() ||
      raw.BAGSTROKE_BURN_AMOUNT_RAW?.trim() ||
      "100000000000",
    BAGSTROKE_TOKEN_DECIMALS:
      raw.TIANSHI_TOKEN_DECIMALS?.trim() ||
      raw.BAGSTROKE_TOKEN_DECIMALS?.trim() ||
      "6",
    LAUNCHONOMICS_TOKEN_MINT:
      raw.LAUNCHONOMICS_TOKEN_MINT?.trim() ||
      raw.TIANSHI_TOKEN_MINT?.trim() ||
      raw.BAGSTROKE_TOKEN_MINT?.trim() ||
      DEFAULT_PUMP_TOKEN_MINT,
    LAUNCHONOMICS_LAUNCH_AT:
      raw.LAUNCHONOMICS_LAUNCH_AT?.trim() ||
      inferLaunchAtFromFreeUntil(process.env.NEXT_PUBLIC_FREE_ACCESS_UNTIL),
    HELIUS_API_KEY: raw.HELIUS_API_KEY?.trim() || "",
    BIRDEYE_API_KEY: raw.BIRDEYE_API_KEY?.trim() || "",
    FIREBASE_PROJECT_ID: raw.FIREBASE_PROJECT_ID?.trim() || "",
    FIREBASE_CLIENT_EMAIL: raw.FIREBASE_CLIENT_EMAIL?.trim() || "",
    FIREBASE_PRIVATE_KEY: raw.FIREBASE_PRIVATE_KEY?.trim() || "",
    FIREBASE_STORAGE_BUCKET: raw.FIREBASE_STORAGE_BUCKET?.trim() || "",
    AGENT_MODEL_PROVIDER:
      raw.AGENT_MODEL_PROVIDER?.trim() || "vertex-ai-gemini",
    GOOGLE_GENAI_USE_VERTEXAI:
      raw.GOOGLE_GENAI_USE_VERTEXAI?.trim().toLowerCase() || "true",
    VERTEX_AI_PROJECT_ID:
      raw.VERTEX_AI_PROJECT_ID?.trim() ||
      raw.FIREBASE_PROJECT_ID?.trim() ||
      firebaseConfigProjectId ||
      (!isProduction ? "tianezha-app" : ""),
    VERTEX_AI_LOCATION: raw.VERTEX_AI_LOCATION?.trim() || "global",
    VERTEX_AI_MODEL: raw.VERTEX_AI_MODEL?.trim() || "gemini-2.5-flash",
    WORKER_URL: raw.WORKER_URL?.trim() || "",
    WORKER_TOKEN: resolveValue(
      raw.WORKER_TOKEN,
      "tianshi-worker-secret",
      isProduction,
      "WORKER_TOKEN",
      16,
    ),
    ALLOW_IN_PROCESS_WORKER: allowInProcessWorker,
    PUBLIC_AUTOBLOW_DEVICE_TOKEN: raw.PUBLIC_AUTOBLOW_DEVICE_TOKEN?.trim() || "",
    PUBLIC_AUTOBLOW_DEVICE_LABEL:
      raw.PUBLIC_AUTOBLOW_DEVICE_LABEL?.trim() || "Tianshi Public Device",
    TIANSHI_TELEGRAM_BOT_TOKEN:
      raw.TIANSHI_TELEGRAM_BOT_TOKEN?.trim() || "",
    TIANSHI_TELEGRAM_CHAT_ID:
      raw.TIANSHI_TELEGRAM_CHAT_ID?.trim() || "",
    TIANSHI_TELEGRAM_THREAD_ID:
      raw.TIANSHI_TELEGRAM_THREAD_ID?.trim() || "",
    TIANSHI_TELEGRAM_DESCRIPTION:
      raw.TIANSHI_TELEGRAM_DESCRIPTION?.trim() ||
      "Read-only Tianshi telemetry bot. Posts heartbeats, reasoning, and trade traces from the autonomous runtime.",
    TIANSHI_TELEGRAM_SHORT_DESCRIPTION:
      raw.TIANSHI_TELEGRAM_SHORT_DESCRIPTION?.trim() ||
      "Read-only Tianshi runtime feed.",
    TIANSHI_PARENT_BRAIN_KEY_START:
      raw.TIANSHI_PARENT_BRAIN_KEY_START?.trim() || "",
    TIANSHI_PARENT_BRAIN_KEY_END:
      raw.TIANSHI_PARENT_BRAIN_KEY_END?.trim() || "",
    TIANSHI_PARENT_BRAIN_SIGNATURE:
      raw.TIANSHI_PARENT_BRAIN_SIGNATURE?.trim() || "",
    TIANSHI_WECHAT_WEBHOOK_URL:
      raw.TIANSHI_WECHAT_WEBHOOK_URL?.trim() || "",
    TIANSHI_WECHAT_BOT_NAME:
      raw.TIANSHI_WECHAT_BOT_NAME?.trim() || "Tianshi",
    TIANSHI_WECHAT_CHANNEL_LABEL:
      raw.TIANSHI_WECHAT_CHANNEL_LABEL?.trim() || "WeChat relay",
    TIANSHI_RISK_RISK_PER_TRADE_PCT:
      raw.TIANSHI_RISK_RISK_PER_TRADE_PCT?.trim() || "0.5",
    TIANSHI_RISK_KELLY_CLIP_MULTIPLIER:
      raw.TIANSHI_RISK_KELLY_CLIP_MULTIPLIER?.trim() || "0.25",
    TIANSHI_RISK_POSITION_HARD_CAP_PCT:
      raw.TIANSHI_RISK_POSITION_HARD_CAP_PCT?.trim() || "10",
    TIANSHI_RISK_MIN_TOP_OF_BOOK_DEPTH_USD:
      raw.TIANSHI_RISK_MIN_TOP_OF_BOOK_DEPTH_USD?.trim() || "50000",
    TIANSHI_RISK_MIN_FIVE_MINUTE_VOLUME_USD:
      raw.TIANSHI_RISK_MIN_FIVE_MINUTE_VOLUME_USD?.trim() || "100000",
    TIANSHI_RISK_MAX_SPREAD_BPS:
      raw.TIANSHI_RISK_MAX_SPREAD_BPS?.trim() || "30",
    TIANSHI_RISK_FREEZE_AFTER_RED_TRADES:
      raw.TIANSHI_RISK_FREEZE_AFTER_RED_TRADES?.trim() || "3",
    TIANSHI_RISK_MIN_SAMPLE_TRADES_BEFORE_CHANGE:
      raw.TIANSHI_RISK_MIN_SAMPLE_TRADES_BEFORE_CHANGE?.trim() || "80",
    TIANSHI_RISK_SAME_DAY_LIVE_PARAM_CHANGES:
      raw.TIANSHI_RISK_SAME_DAY_LIVE_PARAM_CHANGES?.trim().toLowerCase() || "false",
    TIANSHI_GMGN_API_KEY: raw.TIANSHI_GMGN_API_KEY?.trim() || "",
    TIANSHI_GMGN_AUTH_PRIVATE_KEY:
      raw.TIANSHI_GMGN_AUTH_PRIVATE_KEY?.trim() || "",
    TIANSHI_GMGN_TRADING_WALLET:
      raw.TIANSHI_GMGN_TRADING_WALLET?.trim() || "",
    TIANSHI_GMGN_TRADING_SECRET:
      raw.TIANSHI_GMGN_TRADING_SECRET?.trim() || "",
    TIANSHI_GMGN_API_HOST:
      raw.TIANSHI_GMGN_API_HOST?.trim() || "https://gmgn.ai",
    LIVESTREAM_STANDARD_PRICE_SOL:
      raw.LIVESTREAM_STANDARD_PRICE_SOL?.trim() || "0.0069",
    LIVESTREAM_PRIORITY_PRICE_SOL:
      raw.LIVESTREAM_PRIORITY_PRICE_SOL?.trim() || "0.01",
    LIVESTREAM_SESSION_SECONDS:
      raw.LIVESTREAM_SESSION_SECONDS?.trim() || "120",
    LIVESTREAM_REQUESTER_COOLDOWN_SECONDS:
      raw.LIVESTREAM_REQUESTER_COOLDOWN_SECONDS?.trim() || "120",
    LIVESTREAM_CONTRACT_COOLDOWN_SECONDS:
      raw.LIVESTREAM_CONTRACT_COOLDOWN_SECONDS?.trim() || "600",
    LIVESTREAM_MAX_QUEUE_LENGTH:
      raw.LIVESTREAM_MAX_QUEUE_LENGTH?.trim() || "25",
    TIANSHI_X402_BUDGET_USD:
      raw.TIANSHI_X402_BUDGET_USD?.trim() || "25.00",
    TIANSHI_X402_PER_REQUEST_USD:
      raw.TIANSHI_X402_PER_REQUEST_USD?.trim() || "1.00",
    TIANSHI_X402_PER_HOUR_USD:
      raw.TIANSHI_X402_PER_HOUR_USD?.trim() || "5.00",
    TIANSHI_X402_ALLOWED_DOMAINS:
      raw.TIANSHI_X402_ALLOWED_DOMAINS?.trim() || "",
    TIANSHI_DEXTER_ENABLED:
      raw.TIANSHI_DEXTER_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_DEXTER_PATH:
      raw.TIANSHI_DEXTER_PATH?.trim() ||
      "services/tianshi-automaton/vendor/dexter-upstream",
    TIANSHI_DEXTER_PYTHON_BIN:
      raw.TIANSHI_DEXTER_PYTHON_BIN?.trim() || "",
    TIANSHI_DEXTER_DATABASE_URL:
      raw.TIANSHI_DEXTER_DATABASE_URL?.trim() || "",
    TIANSHI_DEXTER_HTTP_URL:
      raw.TIANSHI_DEXTER_HTTP_URL?.trim() || raw.SOLANA_RPC_URL?.trim() || "",
    TIANSHI_DEXTER_WS_URL:
      raw.TIANSHI_DEXTER_WS_URL?.trim() || "",
    TIANSHI_DEXTER_NETWORK:
      raw.TIANSHI_DEXTER_NETWORK?.trim().toLowerCase() || "mainnet",
    TIANSHI_DEXTER_DEFAULT_MODE:
      raw.TIANSHI_DEXTER_DEFAULT_MODE?.trim().toLowerCase() || "read_only",
    TIANSHI_DEXTER_ALLOW_LIVE:
      raw.TIANSHI_DEXTER_ALLOW_LIVE?.trim().toLowerCase() || "false",
    TIANSHI_DEXTER_MAINNET_DRY_RUN:
      raw.TIANSHI_DEXTER_MAINNET_DRY_RUN?.trim().toLowerCase() || "true",
    TIANSHI_GODMODE_ENABLED:
      raw.TIANSHI_GODMODE_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_GODMODE_API_URL:
      raw.TIANSHI_GODMODE_API_URL?.trim() || "https://godmod3.ai",
    TIANSHI_GODMODE_API_KEY:
      raw.TIANSHI_GODMODE_API_KEY?.trim() || "",
    TIANSHI_GODMODE_OPENROUTER_KEY:
      raw.TIANSHI_GODMODE_OPENROUTER_KEY?.trim() || "",
    TIANSHI_GODMODE_DEFAULT_MODEL:
      raw.TIANSHI_GODMODE_DEFAULT_MODEL?.trim() || "ultraplinian/fast",
    TIANSHI_AGFUND_ENABLED:
      raw.TIANSHI_AGFUND_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_AGFUND_API_URL:
      raw.TIANSHI_AGFUND_API_URL?.trim() || "https://agfund.xyz",
    TIANSHI_AGFUND_API_KEY:
      raw.TIANSHI_AGFUND_API_KEY?.trim() || "",
    TIANSHI_AGFUND_MARKETPLACE_URL:
      raw.TIANSHI_AGFUND_MARKETPLACE_URL?.trim() || "https://agfund.xyz/marketplace",
    TIANSHI_FOURMEME_ENABLED:
      raw.TIANSHI_FOURMEME_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_FOURMEME_AGENTIC_URL:
      raw.TIANSHI_FOURMEME_AGENTIC_URL?.trim() || "https://four.meme/agentic",
    TIANSHI_HYPERLIQUID_ENABLED:
      raw.TIANSHI_HYPERLIQUID_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_HYPERLIQUID_API_URL:
      raw.TIANSHI_HYPERLIQUID_API_URL?.trim() || "https://api.hyperliquid.xyz",
    TIANSHI_HYPERLIQUID_WS_URL:
      raw.TIANSHI_HYPERLIQUID_WS_URL?.trim() || "wss://api.hyperliquid.xyz/ws",
    TIANSHI_HYPERLIQUID_MASTER_WALLET:
      raw.TIANSHI_HYPERLIQUID_MASTER_WALLET?.trim().toLowerCase() || "",
    TIANSHI_HYPERLIQUID_API_WALLET:
      raw.TIANSHI_HYPERLIQUID_API_WALLET?.trim().toLowerCase() || "",
    TIANSHI_HYPERLIQUID_API_WALLET_SECRET:
      raw.TIANSHI_HYPERLIQUID_API_WALLET_SECRET?.trim() || "",
    TIANSHI_HYPERLIQUID_DEFAULT_DEX:
      raw.TIANSHI_HYPERLIQUID_DEFAULT_DEX?.trim() || "",
    TIANSHI_HYPERLIQUID_ALLOW_LIVE:
      raw.TIANSHI_HYPERLIQUID_ALLOW_LIVE?.trim().toLowerCase() || "false",
    TIANSHI_POLYMARKET_ENABLED:
      raw.TIANSHI_POLYMARKET_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_POLYMARKET_GAMMA_URL:
      raw.TIANSHI_POLYMARKET_GAMMA_URL?.trim() ||
      "https://gamma-api.polymarket.com",
    TIANSHI_POLYMARKET_CLOB_URL:
      raw.TIANSHI_POLYMARKET_CLOB_URL?.trim() || "https://clob.polymarket.com",
    TIANSHI_POLYMARKET_DEFAULT_MODE:
      raw.TIANSHI_POLYMARKET_DEFAULT_MODE?.trim().toLowerCase() || "read_only",
    TIANSHI_POLYMARKET_ALLOW_LIVE:
      raw.TIANSHI_POLYMARKET_ALLOW_LIVE?.trim().toLowerCase() || "false",
    TIANSHI_POLYMARKET_TOS_ACK:
      raw.TIANSHI_POLYMARKET_TOS_ACK?.trim().toLowerCase() || "false",
    TIANSHI_REPORT_COMMERCE_ENABLED:
      raw.TIANSHI_REPORT_COMMERCE_ENABLED?.trim().toLowerCase() || "true",
    TIANSHI_REPORT_PRICE_USDC:
      raw.TIANSHI_REPORT_PRICE_USDC?.trim() || "0.01",
    TIANSHI_REPORT_BUY_WINDOW_SECONDS:
      raw.TIANSHI_REPORT_BUY_WINDOW_SECONDS?.trim() || "1",
    TIANSHI_REPORT_TRADE_DELAY_SECONDS:
      raw.TIANSHI_REPORT_TRADE_DELAY_SECONDS?.trim() || "1",
    TIANSHI_KNOWLEDGE_SALES_ENABLED:
      raw.TIANSHI_KNOWLEDGE_SALES_ENABLED?.trim().toLowerCase() || "true",
    YT_DLP_COOKIES_PATH: raw.YT_DLP_COOKIES_PATH?.trim() || "",
    YT_DLP_COOKIES_FROM_BROWSER:
      raw.YT_DLP_COOKIES_FROM_BROWSER?.trim() || "",
  });
}

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = resolveServerEnv(rawServerEnvSchema.parse(process.env));
  }

  return cachedServerEnv;
}

export function resetServerEnvForTests() {
  cachedServerEnv = null;
}

export function getPublicEnv(): PublicEnv {
  const raw = rawPublicEnvSchema.parse(process.env);
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: raw.NEXT_PUBLIC_APP_NAME?.trim() || "Tianshi",
    NEXT_PUBLIC_SOLANA_RPC_URL:
      raw.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
      "https://api.mainnet-beta.solana.com",
    NEXT_PUBLIC_SOLANA_NETWORK:
      raw.NEXT_PUBLIC_SOLANA_NETWORK ?? "mainnet-beta",
    NEXT_PUBLIC_TREASURY_WALLET:
      raw.NEXT_PUBLIC_TREASURY_WALLET?.trim() ||
      process.env.TREASURY_WALLET?.trim() ||
      "HQhD7ZRMp4jv2NFdN26nJ5NCWySQD6nQM9KoG5doapDi",
    NEXT_PUBLIC_ACCESS_CNFT_PRICE_SOL:
      raw.NEXT_PUBLIC_ACCESS_CNFT_PRICE_SOL?.trim() ||
      process.env.ACCESS_CNFT_PRICE_SOL?.trim() ||
      "0.25",
    NEXT_PUBLIC_BAGSTROKE_TOKEN_MINT:
      raw.NEXT_PUBLIC_TIANSHI_TOKEN_MINT?.trim() ||
      raw.NEXT_PUBLIC_BAGSTROKE_TOKEN_MINT?.trim() ||
      process.env.TIANSHI_TOKEN_MINT?.trim() ||
      process.env.BAGSTROKE_TOKEN_MINT?.trim() ||
      DEFAULT_PUMP_TOKEN_MINT,
    NEXT_PUBLIC_BAGSTROKE_BURN_AMOUNT_RAW:
      raw.NEXT_PUBLIC_TIANSHI_BURN_AMOUNT_RAW?.trim() ||
      raw.NEXT_PUBLIC_BAGSTROKE_BURN_AMOUNT_RAW?.trim() ||
      process.env.TIANSHI_BURN_AMOUNT_RAW?.trim() ||
      process.env.BAGSTROKE_BURN_AMOUNT_RAW?.trim() ||
      "100000000000",
    NEXT_PUBLIC_BAGSTROKE_TOKEN_DECIMALS:
      raw.NEXT_PUBLIC_TIANSHI_TOKEN_DECIMALS?.trim() ||
      raw.NEXT_PUBLIC_BAGSTROKE_TOKEN_DECIMALS?.trim() ||
      process.env.TIANSHI_TOKEN_DECIMALS?.trim() ||
      process.env.BAGSTROKE_TOKEN_DECIMALS?.trim() ||
      "6",
    NEXT_PUBLIC_FREE_ACCESS_UNTIL:
      raw.NEXT_PUBLIC_FREE_ACCESS_UNTIL?.trim() ||
      new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL:
      raw.NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL?.trim() ||
      DEFAULT_ACCESS_TOKEN_SYMBOL,
    NEXT_PUBLIC_LAUNCHONOMICS_LAUNCH_AT:
      raw.NEXT_PUBLIC_LAUNCHONOMICS_LAUNCH_AT?.trim() ||
      process.env.LAUNCHONOMICS_LAUNCH_AT?.trim() ||
      inferLaunchAtFromFreeUntil(raw.NEXT_PUBLIC_FREE_ACCESS_UNTIL),
    NEXT_PUBLIC_TIANSHI_MEDIA_URL:
      raw.NEXT_PUBLIC_TIANSHI_MEDIA_URL?.trim() ||
      raw.NEXT_PUBLIC_LIVESTREAM_EMBED_URL?.trim() ||
      DEFAULT_TIANSHI_STREAM_URL,
    NEXT_PUBLIC_LIVESTREAM_EMBED_URL:
      raw.NEXT_PUBLIC_LIVESTREAM_EMBED_URL?.trim() ||
      raw.NEXT_PUBLIC_TIANSHI_MEDIA_URL?.trim() ||
      DEFAULT_TIANSHI_STREAM_URL,
    NEXT_PUBLIC_LIVESTREAM_STANDARD_PRICE_SOL:
      raw.NEXT_PUBLIC_LIVESTREAM_STANDARD_PRICE_SOL?.trim() ||
      process.env.LIVESTREAM_STANDARD_PRICE_SOL?.trim() ||
      "0.0069",
    NEXT_PUBLIC_LIVESTREAM_PRIORITY_PRICE_SOL:
      raw.NEXT_PUBLIC_LIVESTREAM_PRIORITY_PRICE_SOL?.trim() ||
      process.env.LIVESTREAM_PRIORITY_PRICE_SOL?.trim() ||
      "0.01",
    NEXT_PUBLIC_LIVESTREAM_SESSION_SECONDS:
      raw.NEXT_PUBLIC_LIVESTREAM_SESSION_SECONDS?.trim() ||
      process.env.LIVESTREAM_SESSION_SECONDS?.trim() ||
      "120",
  });
}

export function isFirebaseConfigured() {
  const env = getServerEnv();
  return Boolean(process.env.FIREBASE_CONFIG || hasFirebaseCredentials(env));
}

export function allowInProcessWorker() {
  return getServerEnv().ALLOW_IN_PROCESS_WORKER === "true";
}

export function isProductionEnv() {
  return getServerEnv().NODE_ENV === "production";
}
