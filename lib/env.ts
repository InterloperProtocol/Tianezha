import { z } from "zod";

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
  INTERNAL_ADMIN_LOGIN: z.string().optional(),
  INTERNAL_ADMIN_PASSWORD: z.string().optional(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]).optional(),
  SOLANA_RPC_URL: z.string().optional(),
  TREASURY_WALLET: z.string().optional(),
  ACCESS_CNFT_PRICE_SOL: z.string().optional(),
  ACCESS_CNFT_NAME: z.string().optional(),
  ACCESS_CNFT_METADATA_URI: z.string().optional(),
  ACCESS_CNFT_COLLECTION: z.string().optional(),
  ACCESS_CNFT_TREE: z.string().optional(),
  ACCESS_CNFT_AUTHORITY_SECRET: z.string().optional(),
  GOONCLAW_TOKEN_MINT: z.string().optional(),
  GOONCLAW_OWNER_WALLET: z.string().optional(),
  GOONCLAW_CREATOR_FEES_WALLET: z.string().optional(),
  GOONCLAW_AGENT_WALLET_SECRET: z.string().optional(),
  GOONCLAW_PAYMENT_SWEEP_SECRET: z.string().optional(),
  GOONCLAW_AGENT_RESERVE_FLOOR_SOL: z.string().optional(),
  GOONCLAW_SETTLEMENT_INTERVAL_MINUTES: z.string().optional(),
  GOONCLAW_MEMECOIN_MAX_PORTFOLIO_PCT: z.string().optional(),
  GOONCLAW_AUTONOMOUS_ENABLED: z.string().optional(),
  GOONCLAW_PUBLIC_TRACE_MODE: z.string().optional(),
  GOONCLAW_SKILLS_DIR: z.string().optional(),
  GOONCLAW_AGENT_CONSTITUTION_PATH: z.string().optional(),
  GOONCLAW_CONWAY_ALLOWED_HOSTS: z.string().optional(),
  CONWAY_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  CONTEXT7_API_KEY: z.string().optional(),
  GOONCLAW_BURN_AMOUNT_RAW: z.string().optional(),
  GOONCLAW_TOKEN_DECIMALS: z.string().optional(),
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
  GOONCLAW_TELEGRAM_BOT_TOKEN: z.string().optional(),
  GOONCLAW_TELEGRAM_CHAT_ID: z.string().optional(),
  GOONCLAW_TELEGRAM_THREAD_ID: z.string().optional(),
  GOONCLAW_TELEGRAM_DESCRIPTION: z.string().optional(),
  GOONCLAW_TELEGRAM_SHORT_DESCRIPTION: z.string().optional(),
  GOONCLAW_GMGN_API_KEY: z.string().optional(),
  GOONCLAW_GMGN_TRADING_WALLET: z.string().optional(),
  GOONCLAW_GMGN_TRADING_SECRET: z.string().optional(),
  GOONCLAW_GMGN_API_HOST: z.string().optional(),
  LIVESTREAM_STANDARD_PRICE_SOL: z.string().optional(),
  LIVESTREAM_PRIORITY_PRICE_SOL: z.string().optional(),
  LIVESTREAM_SESSION_SECONDS: z.string().optional(),
  LIVESTREAM_REQUESTER_COOLDOWN_SECONDS: z.string().optional(),
  LIVESTREAM_CONTRACT_COOLDOWN_SECONDS: z.string().optional(),
  LIVESTREAM_MAX_QUEUE_LENGTH: z.string().optional(),
  GOONCLAW_X402_BUDGET_USD: z.string().optional(),
  GOONCLAW_X402_PER_REQUEST_USD: z.string().optional(),
  GOONCLAW_X402_PER_HOUR_USD: z.string().optional(),
  GOONCLAW_X402_ALLOWED_DOMAINS: z.string().optional(),
  YT_DLP_COOKIES_PATH: z.string().optional(),
  YT_DLP_COOKIES_FROM_BROWSER: z.string().optional(),
});

const resolvedServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  APP_SESSION_SECRET: z.string().min(1),
  DEVICE_CREDENTIALS_AES_KEY: z.string().min(1),
  PAYLOAD_SECRET: z.string().min(1),
  PAYLOAD_DATABASE_URL: z.string().min(1),
  INTERNAL_ADMIN_LOGIN: z.string().min(1),
  INTERNAL_ADMIN_PASSWORD: z.string(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]),
  SOLANA_RPC_URL: z.string().min(1),
  TREASURY_WALLET: z.string().min(1),
  ACCESS_CNFT_PRICE_SOL: z.string().min(1),
  ACCESS_CNFT_NAME: z.string().min(1),
  ACCESS_CNFT_METADATA_URI: z.string().min(1),
  ACCESS_CNFT_COLLECTION: z.string(),
  ACCESS_CNFT_TREE: z.string(),
  ACCESS_CNFT_AUTHORITY_SECRET: z.string(),
  BAGSTROKE_TOKEN_MINT: z.string(),
  GOONCLAW_OWNER_WALLET: z.string().min(1),
  GOONCLAW_CREATOR_FEES_WALLET: z.string().min(1),
  GOONCLAW_AGENT_WALLET_SECRET: z.string(),
  GOONCLAW_PAYMENT_SWEEP_SECRET: z.string(),
  GOONCLAW_AGENT_RESERVE_FLOOR_SOL: z.string().min(1),
  GOONCLAW_SETTLEMENT_INTERVAL_MINUTES: z.string().min(1),
  GOONCLAW_MEMECOIN_MAX_PORTFOLIO_PCT: z.string().min(1),
  GOONCLAW_AUTONOMOUS_ENABLED: z.enum(["true", "false"]),
  GOONCLAW_PUBLIC_TRACE_MODE: z.string().min(1),
  GOONCLAW_SKILLS_DIR: z.string().min(1),
  GOONCLAW_AGENT_CONSTITUTION_PATH: z.string().min(1),
  GOONCLAW_CONWAY_ALLOWED_HOSTS: z.string().min(1),
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
  GOONCLAW_TELEGRAM_BOT_TOKEN: z.string(),
  GOONCLAW_TELEGRAM_CHAT_ID: z.string(),
  GOONCLAW_TELEGRAM_THREAD_ID: z.string(),
  GOONCLAW_TELEGRAM_DESCRIPTION: z.string(),
  GOONCLAW_TELEGRAM_SHORT_DESCRIPTION: z.string(),
  GOONCLAW_GMGN_API_KEY: z.string(),
  GOONCLAW_GMGN_TRADING_WALLET: z.string(),
  GOONCLAW_GMGN_TRADING_SECRET: z.string(),
  GOONCLAW_GMGN_API_HOST: z.string().min(1),
  LIVESTREAM_STANDARD_PRICE_SOL: z.string().min(1),
  LIVESTREAM_PRIORITY_PRICE_SOL: z.string().min(1),
  LIVESTREAM_SESSION_SECONDS: z.string().min(1),
  LIVESTREAM_REQUESTER_COOLDOWN_SECONDS: z.string().min(1),
  LIVESTREAM_CONTRACT_COOLDOWN_SECONDS: z.string().min(1),
  LIVESTREAM_MAX_QUEUE_LENGTH: z.string().min(1),
  GOONCLAW_X402_BUDGET_USD: z.string().min(1),
  GOONCLAW_X402_PER_REQUEST_USD: z.string().min(1),
  GOONCLAW_X402_PER_HOUR_USD: z.string().min(1),
  GOONCLAW_X402_ALLOWED_DOMAINS: z.string(),
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
  NEXT_PUBLIC_GOONCLAW_TOKEN_MINT: z.string().optional(),
  NEXT_PUBLIC_GOONCLAW_BURN_AMOUNT_RAW: z.string().optional(),
  NEXT_PUBLIC_GOONCLAW_TOKEN_DECIMALS: z.string().optional(),
  NEXT_PUBLIC_BAGSTROKE_TOKEN_MINT: z.string().optional(),
  NEXT_PUBLIC_BAGSTROKE_BURN_AMOUNT_RAW: z.string().optional(),
  NEXT_PUBLIC_BAGSTROKE_TOKEN_DECIMALS: z.string().optional(),
  NEXT_PUBLIC_FREE_ACCESS_UNTIL: z.string().optional(),
  NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL: z.string().optional(),
  NEXT_PUBLIC_LAUNCHONOMICS_LAUNCH_AT: z.string().optional(),
  NEXT_PUBLIC_GOONCLAW_MEDIA_URL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_EMBED_URL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_STANDARD_PRICE_SOL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_PRIORITY_PRICE_SOL: z.string().optional(),
  NEXT_PUBLIC_LIVESTREAM_SESSION_SECONDS: z.string().optional(),
});

const DEFAULT_GOONCLAW_STREAM_URL = "https://www.youtube.com/watch?v=e5nyQmaq4k4";

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
  NEXT_PUBLIC_GOONCLAW_MEDIA_URL: z.string(),
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
      "goonclaw-dev-session-secret",
      isProduction,
      "APP_SESSION_SECRET",
      16,
    ),
    DEVICE_CREDENTIALS_AES_KEY: resolveValue(
      raw.DEVICE_CREDENTIALS_AES_KEY,
      "goonclaw-dev-device-key",
      isProduction,
      "DEVICE_CREDENTIALS_AES_KEY",
      16,
    ),
    PAYLOAD_SECRET: resolveValue(
      raw.PAYLOAD_SECRET?.trim() || raw.APP_SESSION_SECRET?.trim(),
      "goonclaw-dev-payload-secret",
      isProduction,
      "PAYLOAD_SECRET",
      16,
    ),
    PAYLOAD_DATABASE_URL:
      raw.PAYLOAD_DATABASE_URL?.trim() || "file:./.data/goonclaw-payload.db",
    INTERNAL_ADMIN_LOGIN: raw.INTERNAL_ADMIN_LOGIN?.trim() || "admin",
    INTERNAL_ADMIN_PASSWORD: raw.INTERNAL_ADMIN_PASSWORD?.trim() || "",
    SOLANA_NETWORK: raw.SOLANA_NETWORK ?? "mainnet-beta",
    SOLANA_RPC_URL:
      raw.SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com",
    TREASURY_WALLET:
      raw.TREASURY_WALLET?.trim() ||
      "HQhD7ZRMp4jv2NFdN26nJ5NCWySQD6nQM9KoG5doapDi",
    ACCESS_CNFT_PRICE_SOL: raw.ACCESS_CNFT_PRICE_SOL?.trim() || "0.25",
    ACCESS_CNFT_NAME:
      raw.ACCESS_CNFT_NAME?.trim() || "GoonClaw Access Pass",
    ACCESS_CNFT_METADATA_URI:
      raw.ACCESS_CNFT_METADATA_URI?.trim() ||
      "https://example.com/goonclaw-access.json",
    ACCESS_CNFT_COLLECTION: raw.ACCESS_CNFT_COLLECTION?.trim() || "",
    ACCESS_CNFT_TREE: raw.ACCESS_CNFT_TREE?.trim() || "",
    ACCESS_CNFT_AUTHORITY_SECRET:
      raw.ACCESS_CNFT_AUTHORITY_SECRET?.trim() || "",
    BAGSTROKE_TOKEN_MINT:
      raw.GOONCLAW_TOKEN_MINT?.trim() ||
      raw.BAGSTROKE_TOKEN_MINT?.trim() ||
      DEFAULT_PUMP_TOKEN_MINT,
    GOONCLAW_OWNER_WALLET:
      raw.GOONCLAW_OWNER_WALLET?.trim() ||
      raw.TREASURY_WALLET?.trim() ||
      "HQhD7ZRMp4jv2NFdN26nJ5NCWySQD6nQM9KoG5doapDi",
    GOONCLAW_CREATOR_FEES_WALLET:
      raw.GOONCLAW_CREATOR_FEES_WALLET?.trim() ||
      raw.GOONCLAW_OWNER_WALLET?.trim() ||
      raw.TREASURY_WALLET?.trim() ||
      "HQhD7ZRMp4jv2NFdN26nJ5NCWySQD6nQM9KoG5doapDi",
    GOONCLAW_AGENT_WALLET_SECRET:
      raw.GOONCLAW_AGENT_WALLET_SECRET?.trim() || "",
    GOONCLAW_PAYMENT_SWEEP_SECRET:
      raw.GOONCLAW_PAYMENT_SWEEP_SECRET?.trim() ||
      raw.GOONCLAW_AGENT_WALLET_SECRET?.trim() ||
      "",
    GOONCLAW_AGENT_RESERVE_FLOOR_SOL:
      raw.GOONCLAW_AGENT_RESERVE_FLOOR_SOL?.trim() || "0.069420",
    GOONCLAW_SETTLEMENT_INTERVAL_MINUTES:
      raw.GOONCLAW_SETTLEMENT_INTERVAL_MINUTES?.trim() || "15",
    GOONCLAW_MEMECOIN_MAX_PORTFOLIO_PCT:
      raw.GOONCLAW_MEMECOIN_MAX_PORTFOLIO_PCT?.trim() || "10",
    GOONCLAW_AUTONOMOUS_ENABLED:
      raw.GOONCLAW_AUTONOMOUS_ENABLED?.trim().toLowerCase() || "true",
    GOONCLAW_PUBLIC_TRACE_MODE:
      raw.GOONCLAW_PUBLIC_TRACE_MODE?.trim() || "maximum-available",
    GOONCLAW_SKILLS_DIR:
      raw.GOONCLAW_SKILLS_DIR?.trim() ||
      "services/goonclaw-automaton/vendor",
    GOONCLAW_AGENT_CONSTITUTION_PATH:
      raw.GOONCLAW_AGENT_CONSTITUTION_PATH?.trim() ||
      "services/goonclaw-automaton/constitution.md",
    GOONCLAW_CONWAY_ALLOWED_HOSTS:
      raw.GOONCLAW_CONWAY_ALLOWED_HOSTS?.trim() ||
      "conway.tech,*.conway.tech,conway.ai,*.conway.ai",
    CONWAY_API_KEY: raw.CONWAY_API_KEY?.trim() || "",
    TAVILY_API_KEY: raw.TAVILY_API_KEY?.trim() || "",
    CONTEXT7_API_KEY: raw.CONTEXT7_API_KEY?.trim() || "",
    BAGSTROKE_BURN_AMOUNT_RAW:
      raw.GOONCLAW_BURN_AMOUNT_RAW?.trim() ||
      raw.BAGSTROKE_BURN_AMOUNT_RAW?.trim() ||
      "100000000000",
    BAGSTROKE_TOKEN_DECIMALS:
      raw.GOONCLAW_TOKEN_DECIMALS?.trim() ||
      raw.BAGSTROKE_TOKEN_DECIMALS?.trim() ||
      "6",
    LAUNCHONOMICS_TOKEN_MINT:
      raw.LAUNCHONOMICS_TOKEN_MINT?.trim() ||
      raw.GOONCLAW_TOKEN_MINT?.trim() ||
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
      (!isProduction ? "goonclaw-app" : ""),
    VERTEX_AI_LOCATION: raw.VERTEX_AI_LOCATION?.trim() || "global",
    VERTEX_AI_MODEL: raw.VERTEX_AI_MODEL?.trim() || "gemini-2.5-flash",
    WORKER_URL: raw.WORKER_URL?.trim() || "",
    WORKER_TOKEN: resolveValue(
      raw.WORKER_TOKEN,
      "goonclaw-worker-secret",
      isProduction,
      "WORKER_TOKEN",
      16,
    ),
    ALLOW_IN_PROCESS_WORKER: allowInProcessWorker,
    PUBLIC_AUTOBLOW_DEVICE_TOKEN: raw.PUBLIC_AUTOBLOW_DEVICE_TOKEN?.trim() || "",
    PUBLIC_AUTOBLOW_DEVICE_LABEL:
      raw.PUBLIC_AUTOBLOW_DEVICE_LABEL?.trim() || "GoonClaw Public Device",
    GOONCLAW_TELEGRAM_BOT_TOKEN:
      raw.GOONCLAW_TELEGRAM_BOT_TOKEN?.trim() || "",
    GOONCLAW_TELEGRAM_CHAT_ID:
      raw.GOONCLAW_TELEGRAM_CHAT_ID?.trim() || "",
    GOONCLAW_TELEGRAM_THREAD_ID:
      raw.GOONCLAW_TELEGRAM_THREAD_ID?.trim() || "",
    GOONCLAW_TELEGRAM_DESCRIPTION:
      raw.GOONCLAW_TELEGRAM_DESCRIPTION?.trim() ||
      "Read-only GoonClaw telemetry bot. Posts heartbeats, reasoning, and trade traces from the autonomous runtime.",
    GOONCLAW_TELEGRAM_SHORT_DESCRIPTION:
      raw.GOONCLAW_TELEGRAM_SHORT_DESCRIPTION?.trim() ||
      "Read-only GoonClaw runtime feed.",
    GOONCLAW_GMGN_API_KEY: raw.GOONCLAW_GMGN_API_KEY?.trim() || "",
    GOONCLAW_GMGN_TRADING_WALLET:
      raw.GOONCLAW_GMGN_TRADING_WALLET?.trim() || "",
    GOONCLAW_GMGN_TRADING_SECRET:
      raw.GOONCLAW_GMGN_TRADING_SECRET?.trim() || "",
    GOONCLAW_GMGN_API_HOST:
      raw.GOONCLAW_GMGN_API_HOST?.trim() || "https://gmgn.ai",
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
    GOONCLAW_X402_BUDGET_USD:
      raw.GOONCLAW_X402_BUDGET_USD?.trim() || "25.00",
    GOONCLAW_X402_PER_REQUEST_USD:
      raw.GOONCLAW_X402_PER_REQUEST_USD?.trim() || "1.00",
    GOONCLAW_X402_PER_HOUR_USD:
      raw.GOONCLAW_X402_PER_HOUR_USD?.trim() || "5.00",
    GOONCLAW_X402_ALLOWED_DOMAINS:
      raw.GOONCLAW_X402_ALLOWED_DOMAINS?.trim() || "",
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

export function getPublicEnv(): PublicEnv {
  const raw = rawPublicEnvSchema.parse(process.env);
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: raw.NEXT_PUBLIC_APP_NAME?.trim() || "GoonClaw",
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
      raw.NEXT_PUBLIC_GOONCLAW_TOKEN_MINT?.trim() ||
      raw.NEXT_PUBLIC_BAGSTROKE_TOKEN_MINT?.trim() ||
      process.env.GOONCLAW_TOKEN_MINT?.trim() ||
      process.env.BAGSTROKE_TOKEN_MINT?.trim() ||
      DEFAULT_PUMP_TOKEN_MINT,
    NEXT_PUBLIC_BAGSTROKE_BURN_AMOUNT_RAW:
      raw.NEXT_PUBLIC_GOONCLAW_BURN_AMOUNT_RAW?.trim() ||
      raw.NEXT_PUBLIC_BAGSTROKE_BURN_AMOUNT_RAW?.trim() ||
      process.env.GOONCLAW_BURN_AMOUNT_RAW?.trim() ||
      process.env.BAGSTROKE_BURN_AMOUNT_RAW?.trim() ||
      "100000000000",
    NEXT_PUBLIC_BAGSTROKE_TOKEN_DECIMALS:
      raw.NEXT_PUBLIC_GOONCLAW_TOKEN_DECIMALS?.trim() ||
      raw.NEXT_PUBLIC_BAGSTROKE_TOKEN_DECIMALS?.trim() ||
      process.env.GOONCLAW_TOKEN_DECIMALS?.trim() ||
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
    NEXT_PUBLIC_GOONCLAW_MEDIA_URL:
      raw.NEXT_PUBLIC_GOONCLAW_MEDIA_URL?.trim() ||
      raw.NEXT_PUBLIC_LIVESTREAM_EMBED_URL?.trim() ||
      DEFAULT_GOONCLAW_STREAM_URL,
    NEXT_PUBLIC_LIVESTREAM_EMBED_URL:
      raw.NEXT_PUBLIC_LIVESTREAM_EMBED_URL?.trim() ||
      raw.NEXT_PUBLIC_GOONCLAW_MEDIA_URL?.trim() ||
      DEFAULT_GOONCLAW_STREAM_URL,
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
