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
  LIVESTREAM_STANDARD_PRICE_SOL: z.string().optional(),
  LIVESTREAM_PRIORITY_PRICE_SOL: z.string().optional(),
  LIVESTREAM_SESSION_SECONDS: z.string().optional(),
  LIVESTREAM_REQUESTER_COOLDOWN_SECONDS: z.string().optional(),
  LIVESTREAM_CONTRACT_COOLDOWN_SECONDS: z.string().optional(),
  LIVESTREAM_MAX_QUEUE_LENGTH: z.string().optional(),
});

const resolvedServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  APP_SESSION_SECRET: z.string().min(1),
  DEVICE_CREDENTIALS_AES_KEY: z.string().min(1),
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
  LIVESTREAM_STANDARD_PRICE_SOL: z.string().min(1),
  LIVESTREAM_PRIORITY_PRICE_SOL: z.string().min(1),
  LIVESTREAM_SESSION_SECONDS: z.string().min(1),
  LIVESTREAM_REQUESTER_COOLDOWN_SECONDS: z.string().min(1),
  LIVESTREAM_CONTRACT_COOLDOWN_SECONDS: z.string().min(1),
  LIVESTREAM_MAX_QUEUE_LENGTH: z.string().min(1),
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
      firebaseConfigProjectId,
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
    LIVESTREAM_STANDARD_PRICE_SOL:
      raw.LIVESTREAM_STANDARD_PRICE_SOL?.trim() || "0.001",
    LIVESTREAM_PRIORITY_PRICE_SOL:
      raw.LIVESTREAM_PRIORITY_PRICE_SOL?.trim() || "0.01",
    LIVESTREAM_SESSION_SECONDS:
      raw.LIVESTREAM_SESSION_SECONDS?.trim() || "60",
    LIVESTREAM_REQUESTER_COOLDOWN_SECONDS:
      raw.LIVESTREAM_REQUESTER_COOLDOWN_SECONDS?.trim() || "120",
    LIVESTREAM_CONTRACT_COOLDOWN_SECONDS:
      raw.LIVESTREAM_CONTRACT_COOLDOWN_SECONDS?.trim() || "600",
    LIVESTREAM_MAX_QUEUE_LENGTH:
      raw.LIVESTREAM_MAX_QUEUE_LENGTH?.trim() || "25",
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
      "",
    NEXT_PUBLIC_LIVESTREAM_EMBED_URL:
      raw.NEXT_PUBLIC_LIVESTREAM_EMBED_URL?.trim() || "",
    NEXT_PUBLIC_LIVESTREAM_STANDARD_PRICE_SOL:
      raw.NEXT_PUBLIC_LIVESTREAM_STANDARD_PRICE_SOL?.trim() ||
      process.env.LIVESTREAM_STANDARD_PRICE_SOL?.trim() ||
      "0.001",
    NEXT_PUBLIC_LIVESTREAM_PRIORITY_PRICE_SOL:
      raw.NEXT_PUBLIC_LIVESTREAM_PRIORITY_PRICE_SOL?.trim() ||
      process.env.LIVESTREAM_PRIORITY_PRICE_SOL?.trim() ||
      "0.01",
    NEXT_PUBLIC_LIVESTREAM_SESSION_SECONDS:
      raw.NEXT_PUBLIC_LIVESTREAM_SESSION_SECONDS?.trim() ||
      process.env.LIVESTREAM_SESSION_SECONDS?.trim() ||
      "60",
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
