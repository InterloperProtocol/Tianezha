import bs58 from "bs58";
import {
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";

import { getServerEnv } from "@/lib/env";

type GmgnSwapMode = "ExactIn" | "ExactOut";

type GmgnRouteResponse = {
  code: number;
  msg: string;
  data?: {
    quote: {
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      otherAmountThreshold: string;
      swapMode: GmgnSwapMode;
      slippageBps: number;
      priceImpactPct?: string;
    };
    raw_tx: {
      swapTransaction: string;
      lastValidBlockHeight: number;
      recentBlockhash: string;
      prioritizationFeeLamports?: number;
    };
  };
};

type GmgnSubmitResponse = {
  code: number;
  msg: string;
  data?: {
    hash: string;
  };
};

type GmgnStatusResponse = {
  code: number;
  msg: string;
  data?: {
    success?: boolean;
    failed?: boolean;
    expired?: boolean;
  };
};

function parseSecretKey(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (trimmed.startsWith("[")) {
      return Uint8Array.from(JSON.parse(trimmed) as number[]);
    }

    return bs58.decode(trimmed);
  } catch {
    return null;
  }
}

function getHeaders() {
  const env = getServerEnv();
  const headers = new Headers({
    Accept: "application/json",
  });

  if (env.GOONCLAW_GMGN_API_KEY) {
    headers.set("x-route-key", env.GOONCLAW_GMGN_API_KEY);
  }

  return headers;
}

function getBaseUrl() {
  return getServerEnv().GOONCLAW_GMGN_API_HOST.replace(/\/+$/, "");
}

export function getGmgnStatus() {
  const env = getServerEnv();
  const signingKey = parseSecretKey(env.GOONCLAW_GMGN_TRADING_SECRET);
  const signerWallet = signingKey
    ? Keypair.fromSecretKey(signingKey).publicKey.toBase58()
    : null;

  return {
    configured: Boolean(env.GOONCLAW_GMGN_API_KEY && env.GOONCLAW_GMGN_TRADING_WALLET),
    signingReady: Boolean(signingKey),
    tradingWallet: env.GOONCLAW_GMGN_TRADING_WALLET || null,
    signerWallet,
    apiHost: getBaseUrl(),
  };
}

export async function getGmgnSwapRoute(args: {
  inputTokenAddress: string;
  outputTokenAddress: string;
  inAmountLamports: string;
  fromAddress?: string;
  slippagePercent: number;
  swapMode?: GmgnSwapMode;
  feeSol?: number;
  isAntiMev?: boolean;
  partner?: string;
}) {
  const env = getServerEnv();
  const fromAddress =
    args.fromAddress?.trim() || env.GOONCLAW_GMGN_TRADING_WALLET.trim();
  if (!fromAddress) {
    throw new Error("GMGN trading wallet is not configured");
  }

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
    headers: getHeaders(),
    method: "GET",
  });
  const payload = (await response.json()) as GmgnRouteResponse;
  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new Error(payload.msg || "GMGN route request failed");
  }

  return payload.data;
}

export async function submitGmgnSignedTransaction(args: {
  signedTransactionBase64: string;
  isAntiMev?: boolean;
}) {
  const response = await fetch(`${getBaseUrl()}/txproxy/v1/send_transaction`, {
    body: JSON.stringify({
      chain: "sol",
      signedTx: args.signedTransactionBase64,
      isAntiMev: args.isAntiMev,
    }),
    headers: new Headers({
      ...Object.fromEntries(getHeaders().entries()),
      "Content-Type": "application/json",
    }),
    method: "POST",
  });

  const payload = (await response.json()) as GmgnSubmitResponse;
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
    headers: getHeaders(),
    method: "GET",
  });
  const payload = (await response.json()) as GmgnStatusResponse;
  if (!response.ok || payload.code !== 0 || !payload.data) {
    throw new Error(payload.msg || "GMGN status request failed");
  }

  return payload.data;
}

export async function signGmgnTransaction(unsignedTransactionBase64: string) {
  const env = getServerEnv();
  const secretKey = parseSecretKey(env.GOONCLAW_GMGN_TRADING_SECRET);
  if (!secretKey) {
    throw new Error("GMGN trading signer is not configured");
  }

  const transaction = VersionedTransaction.deserialize(
    Buffer.from(unsignedTransactionBase64, "base64"),
  );
  const keypair = Keypair.fromSecretKey(secretKey);
  transaction.sign([keypair]);
  return Buffer.from(transaction.serialize()).toString("base64");
}
