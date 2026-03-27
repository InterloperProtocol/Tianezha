import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createBurnCheckedInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

import { getServerEnv } from "@/lib/env";
import {
  executeGmgnSwap,
  getGmgnStatus,
  getGmgnSwapRoute,
  getGmgnTransactionStatus,
  queryGmgnOrder,
  signGmgnTransaction,
  submitGmgnSignedTransaction,
} from "@/lib/server/gmgn";
import {
  closeHyperliquidPerpPosition,
  getHyperliquidCoinFromMarketKey,
  placeHyperliquidPerpOrder,
} from "@/lib/server/hyperliquid-agent";
import type { AutonomousTradePosition } from "@/lib/types";

const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

type TokenBalanceSnapshot = {
  address: string;
  amountRaw: bigint;
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundUsdc(value: number) {
  return Number(value.toFixed(6));
}

function usdcToAtomic(amountUsdc: number) {
  return Math.max(0, Math.round(amountUsdc * 10 ** USDC_DECIMALS)).toString();
}

function atomicToUsdc(amountRaw: bigint) {
  return roundUsdc(Number(amountRaw) / 10 ** USDC_DECIMALS);
}

function getConnection() {
  return new Connection(getServerEnv().SOLANA_RPC_URL, "confirmed");
}

function getQuoteMint() {
  const env = getServerEnv();
  const configured = process.env.CURRENCY_MINT?.trim();
  if (configured) {
    return configured;
  }

  if (env.SOLANA_NETWORK === "mainnet-beta") {
    return MAINNET_USDC_MINT;
  }

  throw new Error(
    "Autonomous settlement requires CURRENCY_MINT when running outside mainnet-beta.",
  );
}

function getTradingSigner() {
  const env = getServerEnv();
  const secretKey = parseSecretKey(env.TIANSHI_GMGN_TRADING_SECRET);
  if (!secretKey) {
    throw new Error("GMGN trading signer is not configured.");
  }

  const signer = Keypair.fromSecretKey(secretKey);
  if (
    env.TIANSHI_GMGN_TRADING_WALLET.trim() &&
    signer.publicKey.toBase58() !== env.TIANSHI_GMGN_TRADING_WALLET.trim()
  ) {
    throw new Error(
      "GMGN trading signer does not match the configured GMGN trading wallet.",
    );
  }

  return signer;
}

async function ensureTokenAccount(args: {
  connection: Connection;
  mint: string;
  owner: PublicKey;
  payer: Keypair;
}) {
  return getOrCreateAssociatedTokenAccount(
    args.connection,
    args.payer,
    new PublicKey(args.mint),
    args.owner,
  );
}

async function getTokenBalanceSnapshot(args: {
  connection: Connection;
  mint: string;
  owner: PublicKey;
  payer?: Keypair;
  createIfMissing?: boolean;
}) {
  const mintKey = new PublicKey(args.mint);

  if (args.createIfMissing && args.payer) {
    const account = await ensureTokenAccount({
      connection: args.connection,
      mint: args.mint,
      owner: args.owner,
      payer: args.payer,
    });

    return {
      address: account.address.toBase58(),
      amountRaw: account.amount,
    } satisfies TokenBalanceSnapshot;
  }

  const address = getAssociatedTokenAddressSync(mintKey, args.owner).toBase58();
  try {
    const account = await getAccount(args.connection, new PublicKey(address));
    return {
      address,
      amountRaw: account.amount,
    } satisfies TokenBalanceSnapshot;
  } catch {
    return {
      address,
      amountRaw: BigInt(0),
    } satisfies TokenBalanceSnapshot;
  }
}

async function waitForGmgnFinality(hash: string, lastValidBlockHeight: number) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = await getGmgnTransactionStatus({
      hash,
      lastValidBlockHeight,
    });

    if (status.success) {
      return;
    }

    if (status.failed) {
      throw new Error(`GMGN transaction ${hash} failed.`);
    }

    if (status.expired) {
      throw new Error(`GMGN transaction ${hash} expired.`);
    }

    await sleep(1500);
  }

  throw new Error(`GMGN transaction ${hash} did not finalize in time.`);
}

async function waitForGmgnOrderConfirmation(orderId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const order = await queryGmgnOrder({
      chain: "sol",
      orderId,
    });

    if (order.status === "confirmed" || order.confirmation?.state === "confirmed") {
      return order;
    }

    if (
      order.status === "failed" ||
      order.status === "expired" ||
      order.confirmation?.state === "failed" ||
      order.confirmation?.state === "expired"
    ) {
      throw new Error(
        order.error_status ||
          order.confirmation?.detail ||
          `GMGN order ${orderId} failed.`,
      );
    }

    await sleep(1500);
  }

  throw new Error(`GMGN order ${orderId} did not finalize in time.`);
}

async function executeSwap(args: {
  inputMint: string;
  outputMint: string;
  inAmountAtomic: string;
  slippagePercent?: number;
}) {
  const gmgnStatus = getGmgnStatus();
  if (gmgnStatus.criticalAuthReady && gmgnStatus.tradeChains.includes("sol")) {
    const order = await executeGmgnSwap({
      chain: "sol",
      inputAmount: args.inAmountAtomic,
      inputToken: args.inputMint,
      outputToken: args.outputMint,
      slippage: (args.slippagePercent ?? 5) / 100,
    });
    const orderId = order.order_id;
    if (!orderId) {
      throw new Error("GMGN swap response did not include an order id.");
    }

    const finalOrder = await waitForGmgnOrderConfirmation(orderId);
    const hash = finalOrder.hash || order.hash;
    if (!hash) {
      throw new Error("GMGN order confirmed without a transaction hash.");
    }

    return {
      hash,
      quotedOutAmount: null,
    };
  }

  const route = await getGmgnSwapRoute({
    feeSol: 0.0001,
    inAmountLamports: args.inAmountAtomic,
    inputTokenAddress: args.inputMint,
    isAntiMev: true,
    outputTokenAddress: args.outputMint,
    partner: "tianshi",
    slippagePercent: args.slippagePercent ?? 5,
  });

  const signedTransactionBase64 = await signGmgnTransaction(
    route.raw_tx.swapTransaction,
  );
  const hash = await submitGmgnSignedTransaction({
    isAntiMev: true,
    signedTransactionBase64,
  });

  await waitForGmgnFinality(hash, route.raw_tx.lastValidBlockHeight);
  return {
    hash,
    quotedOutAmount: route.quote.outAmount,
  };
}

async function transferTokenAtomic(args: {
  amountAtomic: bigint;
  destinationOwner: string;
  mint: string;
}) {
  const connection = getConnection();
  const signer = getTradingSigner();
  const mintKey = new PublicKey(args.mint);
  const mintInfo = await getMint(connection, mintKey);
  const source = await ensureTokenAccount({
    connection,
    mint: args.mint,
    owner: signer.publicKey,
    payer: signer,
  });
  const destination = await ensureTokenAccount({
    connection,
    mint: args.mint,
    owner: new PublicKey(args.destinationOwner),
    payer: signer,
  });

  const transaction = new Transaction().add(
    createTransferCheckedInstruction(
      source.address,
      mintKey,
      destination.address,
      signer.publicKey,
      args.amountAtomic,
      mintInfo.decimals,
    ),
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [signer], {
    commitment: "confirmed",
  });

  return {
    destinationTokenAccount: destination.address.toBase58(),
    signature,
    sourceTokenAccount: source.address.toBase58(),
  };
}

async function burnTokenAtomic(args: {
  amountAtomic: bigint;
  mint: string;
  owner: Keypair;
}) {
  const connection = getConnection();
  const mintKey = new PublicKey(args.mint);
  const mintInfo = await getMint(connection, mintKey);
  const source = await ensureTokenAccount({
    connection,
    mint: args.mint,
    owner: args.owner.publicKey,
    payer: args.owner,
  });

  const transaction = new Transaction().add(
    createBurnCheckedInstruction(
      source.address,
      mintKey,
      args.owner.publicKey,
      args.amountAtomic,
      mintInfo.decimals,
    ),
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [args.owner],
    {
      commitment: "confirmed",
    },
  );

  return {
    signature,
    sourceTokenAccount: source.address.toBase58(),
  };
}

export interface AutonomousSettlementExecutor {
  executeBuybackBurn(args: {
    amountUsdc: number;
    tokenMint: string;
  }): Promise<{
    acquiredAmountRaw: string;
    burnSignature: string;
    buySignature: string;
  }>;
  executeTrade(args: {
    amountUsdc: number;
    marketMint: string;
    leverage?: number | null;
    side?: "long" | "short" | null;
    venue?: AutonomousTradePosition["venue"];
  }): Promise<{
    acquiredAmountRaw: string;
    buySignature: string;
    entryPrice?: number | null;
    leverage?: number | null;
  }>;
  liquidateTrade(args: {
    marketMint: string;
    position?: AutonomousTradePosition;
  }): Promise<{
    exitUsdc: number;
    sellSignature: string | null;
    soldAmountRaw: string;
  }>;
  settleOwnerPayout(args: {
    amountUsdc: number;
    ownerWallet: string;
  }): Promise<{
    destinationTokenAccount: string;
    signature: string;
  }>;
  settleReserveRebalance(args: {
    amountUsdc: number;
    treasuryWallet: string;
  }): Promise<{
    destinationTokenAccount: string;
    signature: string;
  }>;
}

export function createDefaultAutonomousSettlementExecutor(): AutonomousSettlementExecutor {
  return {
    async settleOwnerPayout(args) {
      return transferTokenAtomic({
        amountAtomic: BigInt(usdcToAtomic(args.amountUsdc)),
        destinationOwner: args.ownerWallet,
        mint: getQuoteMint(),
      });
    },

    async settleReserveRebalance(args) {
      return transferTokenAtomic({
        amountAtomic: BigInt(usdcToAtomic(args.amountUsdc)),
        destinationOwner: args.treasuryWallet,
        mint: getQuoteMint(),
      });
    },

    async executeBuybackBurn(args) {
      const connection = getConnection();
      const signer = getTradingSigner();
      const before = await getTokenBalanceSnapshot({
        connection,
        createIfMissing: true,
        mint: args.tokenMint,
        owner: signer.publicKey,
        payer: signer,
      });

      const buy = await executeSwap({
        inAmountAtomic: usdcToAtomic(args.amountUsdc),
        inputMint: getQuoteMint(),
        outputMint: args.tokenMint,
      });

      const after = await getTokenBalanceSnapshot({
        connection,
        mint: args.tokenMint,
        owner: signer.publicKey,
      });
      const acquiredAmountRaw = after.amountRaw - before.amountRaw;
      if (acquiredAmountRaw <= 0) {
        throw new Error("Buyback swap completed without acquiring burnable tokens.");
      }

      const burn = await burnTokenAtomic({
        amountAtomic: acquiredAmountRaw,
        mint: args.tokenMint,
        owner: signer,
      });

      return {
        acquiredAmountRaw: acquiredAmountRaw.toString(),
        burnSignature: burn.signature,
        buySignature: buy.hash,
      };
    },

    async executeTrade(args) {
      if (args.venue === "hyperliquid") {
        return placeHyperliquidPerpOrder({
          coin: getHyperliquidCoinFromMarketKey(args.marketMint),
          leverage: args.leverage,
          notionalUsdc: args.amountUsdc,
          side: args.side || "long",
        });
      }

      const connection = getConnection();
      const signer = getTradingSigner();
      const before = await getTokenBalanceSnapshot({
        connection,
        createIfMissing: true,
        mint: args.marketMint,
        owner: signer.publicKey,
        payer: signer,
      });

      const buy = await executeSwap({
        inAmountAtomic: usdcToAtomic(args.amountUsdc),
        inputMint: getQuoteMint(),
        outputMint: args.marketMint,
      });

      const after = await getTokenBalanceSnapshot({
        connection,
        mint: args.marketMint,
        owner: signer.publicKey,
      });
      const acquiredAmountRaw = after.amountRaw - before.amountRaw;
      if (acquiredAmountRaw <= 0) {
        throw new Error("Trade swap completed without acquiring the target token.");
      }

      return {
        acquiredAmountRaw: acquiredAmountRaw.toString(),
        buySignature: buy.hash,
      };
    },

    async liquidateTrade(args) {
      if (args.position?.venue === "hyperliquid") {
        return closeHyperliquidPerpPosition({
          coin: getHyperliquidCoinFromMarketKey(args.marketMint),
          entryUsdc: args.position.entryUsdc,
        });
      }

      const connection = getConnection();
      const signer = getTradingSigner();
      const positionBalance = await getTokenBalanceSnapshot({
        connection,
        mint: args.marketMint,
        owner: signer.publicKey,
      });

      if (positionBalance.amountRaw <= 0) {
        return {
          exitUsdc: 0,
          sellSignature: null,
          soldAmountRaw: "0",
        };
      }

      const usdcBefore = await getTokenBalanceSnapshot({
        connection,
        createIfMissing: true,
        mint: getQuoteMint(),
        owner: signer.publicKey,
        payer: signer,
      });

      const sell = await executeSwap({
        inAmountAtomic: positionBalance.amountRaw.toString(),
        inputMint: args.marketMint,
        outputMint: getQuoteMint(),
      });

      const usdcAfter = await getTokenBalanceSnapshot({
        connection,
        mint: getQuoteMint(),
        owner: signer.publicKey,
      });

      return {
        exitUsdc: atomicToUsdc(usdcAfter.amountRaw - usdcBefore.amountRaw),
        sellSignature: sell.hash,
        soldAmountRaw: positionBalance.amountRaw.toString(),
      };
    },
  };
}
