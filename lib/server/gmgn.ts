import { createPrivateKey, randomUUID, sign as cryptoSign } from "crypto";

import bs58 from "bs58";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";

import { getServerEnv } from "@/lib/env";

export type GmgnChain = "sol" | "bsc" | "base";
type GmgnSwapMode = "ExactIn" | "ExactOut";
type GmgnAuthMode = "standard" | "critical";

type GmgnEnvelope<T> = {
  code: number;
  data?: T;
  message?: string;
  msg?: string;
  reason?: string;
};

type GmgnQuoteResponse = {
  input_amount: string;
  input_token: string;
  min_output_amount: string;
  output_amount: string;
  output_token: string;
  slippage: number;
};

type GmgnOrderResponse = {
  confirmation?: {
    detail?: string;
    state?: "processed" | "confirmed" | "failed" | "expired";
  };
  error_code?: string;
  error_status?: string;
  hash?: string;
  order_id?: string;
  status?: "pending" | "processed" | "confirmed" | "failed" | "expired";
};

type GmgnLegacyRouteResponse = {
  code: number;
  data?: {
    quote: {
      inAmount: string;
      inputMint: string;
      otherAmountThreshold: string;
      outAmount: string;
      outputMint: string;
      priceImpactPct?: string;
      slippageBps: number;
      swapMode: GmgnSwapMode;
    };
    raw_tx: {
      lastValidBlockHeight: number;
      prioritizationFeeLamports?: number;
      recentBlockhash: string;
      swapTransaction: string;
    };
  };
  msg?: string;
};

type GmgnLegacySubmitResponse = {
  code: number;
  data?: {
    hash: string;
  };
  msg?: string;
};

type GmgnLegacyStatusResponse = {
  code: number;
  data?: {
    expired?: boolean;
    failed?: boolean;
    success?: boolean;
  };
  msg?: string;
};

type GmgnQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

function parseBinarySecret(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith("[")) {
      return Uint8Array.from(JSON.parse(trimmed) as number[]);
    }

    if (/^0x[0-9a-f]+$/i.test(trimmed)) {
      return Uint8Array.from(Buffer.from(trimmed.slice(2), "hex"));
    }

    if (/^[0-9a-f]{64,128}$/i.test(trimmed)) {
      return Uint8Array.from(Buffer.from(trimmed, "hex"));
    }

    try {
      return bs58.decode(trimmed);
    } catch {
      // Fall through to base64 parsing for non-bs58 material.
    }

    if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0) {
      const decoded = Buffer.from(trimmed, "base64");
      if (decoded.length) {
        return Uint8Array.from(decoded);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function parseSolanaSecretKey(secret: string) {
  const parsed = parseBinarySecret(secret);
  if (!parsed) {
    return null;
  }

  if (parsed.length === 64) {
    return parsed;
  }

  if (parsed.length === 32) {
    return Keypair.fromSeed(parsed).secretKey;
  }

  return null;
}

function parseAuthSecretKey(secret: string) {
  const parsed = parseBinarySecret(secret);
  if (!parsed) {
    return null;
  }

  if (parsed.length === 64) {
    return parsed;
  }

  if (parsed.length === 32) {
    return nacl.sign.keyPair.fromSeed(parsed).secretKey;
  }

  return null;
}

function getBaseUrl() {
  return getServerEnv().TIANSHI_GMGN_API_HOST.replace(/\/+$/, "");
}

function getTradingWallet() {
  return getServerEnv().TIANSHI_GMGN_TRADING_WALLET.trim() || null;
}

function getTradeChainsFromWallet(wallet: string | null) {
  if (!wallet) {
    return [] as GmgnChain[];
  }

  if (/^0x[a-f0-9]{40}$/i.test(wallet)) {
    return ["bsc", "base"] as GmgnChain[];
  }

  return ["sol"] as GmgnChain[];
}

function getAuthPrivateKeyMaterial() {
  const env = getServerEnv();
  return env.TIANSHI_GMGN_AUTH_PRIVATE_KEY.trim() || env.TIANSHI_GMGN_TRADING_SECRET.trim();
}

function canSignGmgnCriticalMessage() {
  const privateKeyMaterial = getAuthPrivateKeyMaterial();
  if (!privateKeyMaterial) {
    return false;
  }

  try {
    if (privateKeyMaterial.includes("BEGIN PRIVATE KEY")) {
      createPrivateKey(privateKeyMaterial);
      return true;
    }

    return Boolean(parseAuthSecretKey(privateKeyMaterial));
  } catch {
    return false;
  }
}

function getLegacyRouteHeaders() {
  const env = getServerEnv();
  const headers = new Headers({
    Accept: "application/json",
  });

  if (env.TIANSHI_GMGN_API_KEY) {
    headers.set("x-route-key", env.TIANSHI_GMGN_API_KEY);
  }

  return headers;
}

function buildSortedQueryString(searchParams: URLSearchParams) {
  return new URLSearchParams(
    [...searchParams.entries()].sort(([left], [right]) => left.localeCompare(right)),
  ).toString();
}

function appendQueryValues(url: URL, query?: Record<string, GmgnQueryValue>) {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value == null) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      url.searchParams.append(key, String(entry));
    }
  }
}

function signGmgnCriticalMessage(message: string) {
  const privateKeyMaterial = getAuthPrivateKeyMaterial();
  if (!privateKeyMaterial) {
    throw new Error("GMGN critical auth private key is not configured");
  }

  if (privateKeyMaterial.includes("BEGIN PRIVATE KEY")) {
    const key = createPrivateKey(privateKeyMaterial);
    return cryptoSign(null, Buffer.from(message, "utf8"), key).toString("base64");
  }

  const secretKey = parseAuthSecretKey(privateKeyMaterial);
  if (!secretKey) {
    throw new Error("GMGN critical auth private key is invalid");
  }

  return Buffer.from(
    nacl.sign.detached(Buffer.from(message, "utf8"), secretKey),
  ).toString("base64");
}

async function gmgnFetch<T>(args: {
  authMode: GmgnAuthMode;
  body?: Record<string, unknown>;
  method: "GET" | "POST";
  query?: Record<string, GmgnQueryValue>;
  subPath: string;
}) {
  const apiKey = getServerEnv().TIANSHI_GMGN_API_KEY.trim();
  if (!apiKey) {
    throw new Error("GMGN API key is not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const clientId = randomUUID();
  const url = new URL(`${getBaseUrl()}${args.subPath}`);
  appendQueryValues(url, args.query);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("client_id", clientId);

  const bodyText = args.body ? JSON.stringify(args.body) : "";
  const headers = new Headers({
    Accept: "application/json",
    "X-APIKEY": apiKey,
  });

  if (args.body) {
    headers.set("Content-Type", "application/json");
  }

  if (args.authMode === "critical") {
    const sortedQueryString = buildSortedQueryString(url.searchParams);
    const message = `${args.subPath}:${sortedQueryString}:${bodyText}:${timestamp}`;
    headers.set("X-Signature", signGmgnCriticalMessage(message));
  }

  const response = await fetch(url, {
    body: bodyText || undefined,
    headers,
    method: args.method,
  });
  const payload = (await response.json().catch(() => null)) as GmgnEnvelope<T> | null;

  if (!response.ok || !payload || payload.code !== 0 || payload.data == null) {
    throw new Error(
      payload?.message ||
        payload?.msg ||
        payload?.reason ||
        `GMGN request failed for ${args.subPath}`,
    );
  }

  return payload.data;
}

function getTradingFromAddress(fromAddress?: string | null) {
  const resolved = fromAddress?.trim() || getTradingWallet();
  if (!resolved) {
    throw new Error("GMGN trading wallet is not configured");
  }

  return resolved;
}

function getLocalSignerWallet(secret: string) {
  const secretKey = parseSolanaSecretKey(secret);
  if (!secretKey) {
    return null;
  }

  try {
    return Keypair.fromSecretKey(secretKey).publicKey.toBase58();
  } catch {
    return null;
  }
}

export function getGmgnStatus() {
  const env = getServerEnv();
  const tradingWallet = getTradingWallet();
  const localSignerWallet = getLocalSignerWallet(env.TIANSHI_GMGN_TRADING_SECRET);
  const standardAuthReady = Boolean(env.TIANSHI_GMGN_API_KEY.trim());
  const criticalAuthReady = Boolean(
    standardAuthReady && tradingWallet && canSignGmgnCriticalMessage(),
  );

  return {
    apiHost: getBaseUrl(),
    configured: standardAuthReady,
    criticalAuthReady,
    queryChains: ["sol", "bsc", "base"] as GmgnChain[],
    sharedKeyEnabled: standardAuthReady,
    signerWallet: localSignerWallet,
    signingReady: criticalAuthReady || Boolean(localSignerWallet),
    standardAuthReady,
    toolFamilies: ["token", "market", "trade", "user", "trenches"] as string[],
    tradeChains: getTradeChainsFromWallet(tradingWallet),
    tradingWallet,
  };
}

export async function getGmgnTokenInfo(args: {
  address: string;
  chain: GmgnChain;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    body: args,
    method: "POST",
    subPath: "/v1/token/info",
  });
}

export async function getGmgnTokenPoolInfo(args: {
  address: string;
  chain: GmgnChain;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/token/pool_info",
  });
}

export async function getGmgnTokenSecurity(args: {
  address: string;
  chain: GmgnChain;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/token/security",
  });
}

export async function getGmgnTokenKline(args: {
  address: string;
  chain: GmgnChain;
  interval?: string;
  limit?: number;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/market/token_kline",
  });
}

export async function getGmgnTokenTopTraders(args: {
  address: string;
  chain: GmgnChain;
  limit?: number;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/market/token_top_traders",
  });
}

export async function getGmgnTokenTopHolders(args: {
  address: string;
  chain: GmgnChain;
  limit?: number;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/market/token_top_holders",
  });
}

export async function getGmgnMarketRank(
  args: Record<string, GmgnQueryValue> & { chain: GmgnChain },
) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/market/rank",
  });
}

export async function getGmgnTrenches(
  args: Record<string, GmgnQueryValue> & { chain: GmgnChain },
) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    body: args,
    method: "POST",
    subPath: "/v1/trenches",
  });
}

export async function getGmgnUserInfo() {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    subPath: "/v1/user/info",
  });
}

export async function getGmgnWalletHoldings(args: Record<string, GmgnQueryValue> & {
  chain: GmgnChain;
  wallet_address: string;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/user/wallet_holdings",
  });
}

export async function getGmgnWalletActivity(args: Record<string, GmgnQueryValue> & {
  chain: GmgnChain;
  wallet_address: string;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/user/wallet_activity",
  });
}

export async function getGmgnWalletStats(args: {
  chain: GmgnChain;
  period: "7d" | "30d";
  wallet_address: string;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/user/wallet_stats",
  });
}

export async function getGmgnWalletTokenBalance(args: {
  chain: GmgnChain;
  token_address: string;
  wallet_address: string;
}) {
  return gmgnFetch<Record<string, unknown>>({
    authMode: "standard",
    method: "GET",
    query: args,
    subPath: "/v1/user/wallet_token_balance",
  });
}

export async function getGmgnSwapQuote(args: {
  chain: GmgnChain;
  fromAddress?: string | null;
  inputAmount: string;
  inputToken: string;
  outputToken: string;
  slippage: number;
}) {
  return gmgnFetch<GmgnQuoteResponse>({
    authMode: "standard",
    method: "GET",
    query: {
      chain: args.chain,
      from_address: getTradingFromAddress(args.fromAddress),
      input_amount: args.inputAmount,
      input_token: args.inputToken,
      output_token: args.outputToken,
      slippage: args.slippage,
    },
    subPath: "/v1/trade/quote",
  });
}

export async function executeGmgnSwap(args: {
  autoSlippage?: boolean;
  chain: GmgnChain;
  fromAddress?: string | null;
  inputAmount: string;
  inputToken: string;
  isAntiMev?: boolean;
  outputToken: string;
  slippage?: number;
}) {
  return gmgnFetch<GmgnOrderResponse>({
    authMode: "critical",
    body: {
      auto_slippage: args.autoSlippage ?? false,
      chain: args.chain,
      from_address: getTradingFromAddress(args.fromAddress),
      input_amount: args.inputAmount,
      input_token: args.inputToken,
      is_anti_mev: args.isAntiMev ?? true,
      output_token: args.outputToken,
      slippage: args.slippage ?? 0.01,
    },
    method: "POST",
    subPath: "/v1/trade/swap",
  });
}

export async function queryGmgnOrder(args: {
  chain: GmgnChain;
  orderId: string;
}) {
  return gmgnFetch<GmgnOrderResponse>({
    authMode: "critical",
    method: "GET",
    query: {
      chain: args.chain,
      order_id: args.orderId,
    },
    subPath: "/v1/trade/query_order",
  });
}

export async function getGmgnSwapRoute(args: {
  feeSol?: number;
  fromAddress?: string;
  inAmountLamports: string;
  inputTokenAddress: string;
  isAntiMev?: boolean;
  outputTokenAddress: string;
  partner?: string;
  slippagePercent: number;
  swapMode?: GmgnSwapMode;
}) {
  const fromAddress = getTradingFromAddress(args.fromAddress);
  const url = new URL(`${getBaseUrl()}/defi/router/v1/sol/tx/get_swap_route`);
  url.searchParams.set("token_in_address", args.inputTokenAddress);
  url.searchParams.set("token_out_address", args.outputTokenAddress);
  url.searchParams.set("in_amount", args.inAmountLamports);
  url.searchParams.set("from_address", fromAddress);
  url.searchParams.set("slippage", String(args.slippagePercent));

  if (args.swapMode) {
    url.searchParams.set("swap_mode", args.swapMode);
  }
  if (typeof args.feeSol === "number") {
    url.searchParams.set("fee", String(args.feeSol));
  }
  if (typeof args.isAntiMev === "boolean") {
    url.searchParams.set("is_anti_mev", String(args.isAntiMev));
  }
  if (args.partner?.trim()) {
    url.searchParams.set("partner", args.partner.trim());
  }

  const response = await fetch(url, {
    headers: getLegacyRouteHeaders(),
    method: "GET",
  });
  const payload = (await response.json()) as GmgnLegacyRouteResponse;
  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new Error(payload.msg || "GMGN route request failed");
  }

  return payload.data;
}

export async function submitGmgnSignedTransaction(args: {
  isAntiMev?: boolean;
  signedTransactionBase64: string;
}) {
  const response = await fetch(`${getBaseUrl()}/txproxy/v1/send_transaction`, {
    body: JSON.stringify({
      chain: "sol",
      isAntiMev: args.isAntiMev,
      signedTx: args.signedTransactionBase64,
    }),
    headers: new Headers({
      ...Object.fromEntries(getLegacyRouteHeaders().entries()),
      "Content-Type": "application/json",
    }),
    method: "POST",
  });

  const payload = (await response.json()) as GmgnLegacySubmitResponse;
  if (!response.ok || payload.code !== 0 || !payload.data?.hash) {
    throw new Error(payload.msg || "GMGN transaction submission failed");
  }

  return payload.data.hash;
}

export async function getGmgnTransactionStatus(args: {
  hash: string;
  lastValidBlockHeight: number;
}) {
  const url = new URL(`${getBaseUrl()}/defi/router/v1/sol/tx/get_transaction_status`);
  url.searchParams.set("hash", args.hash);
  url.searchParams.set("last_valid_height", String(args.lastValidBlockHeight));

  const response = await fetch(url, {
    headers: getLegacyRouteHeaders(),
    method: "GET",
  });
  const payload = (await response.json()) as GmgnLegacyStatusResponse;
  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new Error(payload.msg || "GMGN status request failed");
  }

  return payload.data;
}

export async function signGmgnTransaction(unsignedTransactionBase64: string) {
  const secretKey = parseSolanaSecretKey(getServerEnv().TIANSHI_GMGN_TRADING_SECRET);
  if (!secretKey) {
    throw new Error("GMGN local trading signer is not configured");
  }

  const transaction = VersionedTransaction.deserialize(
    Buffer.from(unsignedTransactionBase64, "base64"),
  );
  const keypair = Keypair.fromSecretKey(secretKey);
  transaction.sign([keypair]);
  return Buffer.from(transaction.serialize()).toString("base64");
}
