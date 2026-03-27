import { Connection, PublicKey } from "@solana/web3.js";

import { getServerEnv } from "@/lib/env";

const ERC20_BALANCE_OF_SELECTOR = "0x70a08231";
const ERC20_DECIMALS_SELECTOR = "0x313ce567";
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEFAULT_BNB_VERIFICATION_TARGET =
  "0x000000000000000000000000000000000000dead";

type ParsedTokenAmount = {
  amount?: string;
  decimals?: number;
  uiAmount?: number | null;
  uiAmountString?: string;
};

type BnbTransaction = {
  blockNumber?: string | null;
  from?: string | null;
  hash?: string | null;
  input?: string | null;
  to?: string | null;
  value?: string | null;
};

type BnbReceiptLog = {
  address?: string | null;
  data?: string | null;
  topics?: string[] | null;
};

type BnbTransactionReceipt = {
  logs?: BnbReceiptLog[] | null;
  status?: string | null;
  transactionHash?: string | null;
};

function isHexAddress(value: string) {
  return /^0x[a-f0-9]{40}$/i.test(value.trim());
}

function toHexData(value: string) {
  return `0x${Buffer.from(value, "utf8").toString("hex")}`;
}

function stripHexPrefix(value: string) {
  return value.replace(/^0x/i, "");
}

function padHexAddress(value: string) {
  return stripHexPrefix(value).toLowerCase().padStart(64, "0");
}

function parseHexToBigInt(value: string | null | undefined) {
  if (!value) {
    return BigInt(0);
  }

  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  try {
    return BigInt(normalized);
  } catch {
    return BigInt(0);
  }
}

function formatUnits(value: bigint, decimals: number) {
  if (decimals <= 0) {
    return Number(value);
  }

  const negative = value < 0;
  const absolute = negative ? value * BigInt(-1) : value;
  const digits = absolute.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals) || "0";
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  const rendered = fraction ? `${whole}.${fraction}` : whole;
  const numeric = Number(negative ? `-${rendered}` : rendered);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function callBnbJsonRpc<T>(method: string, params: unknown[]) {
  const response = await fetch(getServerEnv().BNB_RPC_URL, {
    body: JSON.stringify({
      id: `tianezha-${method}`,
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
    next: { revalidate: 15 },
  });

  if (!response.ok) {
    throw new Error(`BNB RPC request failed for ${method}`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: T;
  };

  if (payload.error) {
    throw new Error(payload.error.message || `BNB RPC error for ${method}`);
  }

  return payload.result ?? null;
}

async function readBnbErc20Value(
  tokenAddress: string,
  selector: string,
  encodedArgs = "",
) {
  if (!isHexAddress(tokenAddress)) {
    return null;
  }

  return callBnbJsonRpc<string>("eth_call", [
    {
      data: `${selector}${encodedArgs}`,
      to: tokenAddress,
    },
    "latest",
  ]).catch(() => null);
}

export function getBnbVerificationTarget() {
  const configured = process.env.TIANEZHA_BNB_VERIFICATION_ADDRESS?.trim();
  if (configured && isHexAddress(configured)) {
    return configured.toLowerCase();
  }

  return DEFAULT_BNB_VERIFICATION_TARGET;
}

export function getSolanaVerificationTarget() {
  const configured = process.env.TIANEZHA_SOL_VERIFICATION_ADDRESS?.trim();
  if (configured) {
    return configured;
  }

  return getServerEnv().TREASURY_WALLET;
}

export function buildBnbMemoData(memo: string) {
  return toHexData(memo);
}

export async function getSolanaTokenBalance(
  ownerWallet: string,
  mintAddress: string,
) {
  try {
    const connection = new Connection(getServerEnv().SOLANA_RPC_URL, "confirmed");
    const owner = new PublicKey(ownerWallet);
    const mint = new PublicKey(mintAddress);
    const response = await connection.getParsedTokenAccountsByOwner(
      owner,
      { mint },
      "confirmed",
    );

    return response.value.reduce((sum, account) => {
      const parsed = account.account.data.parsed as {
        info?: { tokenAmount?: ParsedTokenAmount };
      };
      const tokenAmount = parsed.info?.tokenAmount;
      const rendered =
        tokenAmount?.uiAmountString ??
        tokenAmount?.uiAmount?.toString() ??
        (tokenAmount?.amount && tokenAmount.decimals != null
          ? formatUnits(BigInt(tokenAmount.amount), tokenAmount.decimals).toString()
          : "0");
      const numeric = Number(rendered);
      return sum + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
  } catch {
    return null;
  }
}

export async function getBnbTokenBalance(
  ownerWallet: string,
  tokenAddress: string,
) {
  if (!isHexAddress(ownerWallet) || !isHexAddress(tokenAddress)) {
    return null;
  }

  const [rawBalance, rawDecimals] = await Promise.all([
    readBnbErc20Value(
      tokenAddress,
      ERC20_BALANCE_OF_SELECTOR,
      padHexAddress(ownerWallet),
    ),
    readBnbErc20Value(tokenAddress, ERC20_DECIMALS_SELECTOR),
  ]);

  if (!rawBalance) {
    return null;
  }

  const decimals = Number(parseHexToBigInt(rawDecimals || "0x12"));
  return formatUnits(parseHexToBigInt(rawBalance), Number.isFinite(decimals) ? decimals : 18);
}

export async function verifyBnbMemoTransaction(args: {
  expectedFrom: string;
  expectedMemo: string;
  transactionId: string;
}) {
  if (!isHexAddress(args.expectedFrom)) {
    return {
      error: "The loaded profile does not map to a BNB-compatible wallet address.",
      ok: false,
    };
  }

  const transaction = await callBnbJsonRpc<BnbTransaction>("eth_getTransactionByHash", [
    args.transactionId,
  ]).catch(() => null);

  if (!transaction || !transaction.hash) {
    return {
      error: "Transaction not found on BNB Chain.",
      ok: false,
    };
  }

  if (!transaction.blockNumber) {
    return {
      error: "Transaction is still pending confirmation.",
      ok: false,
    };
  }

  const from = String(transaction.from || "").toLowerCase();
  const to = String(transaction.to || "").toLowerCase();
  const expectedFrom = args.expectedFrom.toLowerCase();
  const expectedTarget = getBnbVerificationTarget();
  const expectedMemoHex = buildBnbMemoData(args.expectedMemo).toLowerCase();
  const input = String(transaction.input || "0x").toLowerCase();

  if (from !== expectedFrom) {
    return {
      error: "The BNB transaction sender does not match the profile owner wallet.",
      ok: false,
    };
  }

  if (to !== expectedTarget) {
    return {
      error: `Send the BNB verification transaction to ${expectedTarget}.`,
      ok: false,
    };
  }

  if (input !== expectedMemoHex) {
    return {
      error: "The BNB transaction memo payload does not match the generated verification memo.",
      ok: false,
    };
  }

  return {
    ok: true,
    transactionId: transaction.hash,
    verifiedWallet: from,
  };
}

function sumRawTokenBalance(args: {
  entries:
    | Array<{
        mint?: string;
        owner?: string;
        uiTokenAmount?: ParsedTokenAmount;
      }>
    | null
    | undefined;
  mint: string;
  owner: string;
}) {
  return (args.entries ?? []).reduce((sum, entry) => {
    if (
      entry.mint !== args.mint ||
      String(entry.owner || "").toLowerCase() !== args.owner.toLowerCase()
    ) {
      return sum;
    }

    const rawAmount = entry.uiTokenAmount?.amount;
    if (!rawAmount) {
      return sum;
    }

    return sum + BigInt(rawAmount);
  }, BigInt(0));
}

function getTokenDecimals(args: {
  entries:
    | Array<{
        mint?: string;
        uiTokenAmount?: ParsedTokenAmount;
      }>
    | null
    | undefined;
  mint: string;
}) {
  for (const entry of args.entries ?? []) {
    if (entry.mint === args.mint && entry.uiTokenAmount?.decimals != null) {
      return entry.uiTokenAmount.decimals;
    }
  }

  return null;
}

function toRawTokenAmount(requiredTokenAmount: number, decimals: number) {
  const [wholePart, fractionalPart = ""] = String(requiredTokenAmount).split(".");
  const wholeUnits = BigInt(wholePart || "0") * 10n ** BigInt(decimals);
  if (!fractionalPart || decimals === 0) {
    return wholeUnits;
  }

  const normalizedFraction = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  return wholeUnits + BigInt(normalizedFraction || "0");
}

export async function verifySolanaTokenTransferToTarget(args: {
  expectedFrom: string;
  expectedMint: string;
  expectedTarget: string;
  requiredTokenAmount: number;
  transactionId: string;
}) {
  try {
    const connection = new Connection(getServerEnv().SOLANA_RPC_URL, "confirmed");
    const transaction = await connection.getParsedTransaction(args.transactionId, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction || !transaction.meta) {
      return {
        error: "Transaction not found on Solana.",
        ok: false,
      };
    }

    const signerWallets = transaction.transaction.message.accountKeys
      .filter((key) => key.signer)
      .map((key) => key.pubkey.toBase58());
    if (!signerWallets.includes(args.expectedFrom)) {
      return {
        error: "The Solana verification transfer was not signed by the profile wallet.",
        ok: false,
      };
    }

    const decimals =
      getTokenDecimals({
        entries: transaction.meta.postTokenBalances,
        mint: args.expectedMint,
      }) ??
      getTokenDecimals({
        entries: transaction.meta.preTokenBalances,
        mint: args.expectedMint,
      });
    if (decimals == null) {
      return {
        error: "The Solana verification transfer did not include the expected token mint.",
        ok: false,
      };
    }

    const senderPre = sumRawTokenBalance({
      entries: transaction.meta.preTokenBalances,
      mint: args.expectedMint,
      owner: args.expectedFrom,
    });
    const senderPost = sumRawTokenBalance({
      entries: transaction.meta.postTokenBalances,
      mint: args.expectedMint,
      owner: args.expectedFrom,
    });
    const targetPre = sumRawTokenBalance({
      entries: transaction.meta.preTokenBalances,
      mint: args.expectedMint,
      owner: args.expectedTarget,
    });
    const targetPost = sumRawTokenBalance({
      entries: transaction.meta.postTokenBalances,
      mint: args.expectedMint,
      owner: args.expectedTarget,
    });
    const requiredRaw = toRawTokenAmount(args.requiredTokenAmount, decimals);
    const senderDelta = senderPost - senderPre;
    const targetDelta = targetPost - targetPre;

    if (senderDelta > requiredRaw * BigInt(-1)) {
      return {
        error: `Send at least ${args.requiredTokenAmount} $CAMIUP from the profile wallet.`,
        ok: false,
      };
    }

    if (targetDelta < requiredRaw) {
      return {
        error: `The Solana transfer must send at least ${args.requiredTokenAmount} $CAMIUP to ${args.expectedTarget}.`,
        ok: false,
      };
    }

    return {
      ok: true,
      transactionId: args.transactionId,
      verifiedWallet: args.expectedFrom,
    };
  } catch {
    return {
      error: "Unable to verify the Solana token transfer.",
      ok: false,
    };
  }
}

export async function verifyBnbTokenTransferToTarget(args: {
  expectedFrom: string;
  expectedTarget: string;
  requiredTokenAmount: number;
  tokenAddress: string;
  transactionId: string;
}) {
  if (!isHexAddress(args.expectedFrom)) {
    return {
      error: "The loaded profile does not map to a BNB-compatible wallet address.",
      ok: false,
    };
  }

  if (!isHexAddress(args.expectedTarget)) {
    return {
      error: "The configured BNB verification address is invalid.",
      ok: false,
    };
  }

  const [transaction, receipt, rawDecimals] = await Promise.all([
    callBnbJsonRpc<BnbTransaction>("eth_getTransactionByHash", [
      args.transactionId,
    ]).catch(() => null),
    callBnbJsonRpc<BnbTransactionReceipt>("eth_getTransactionReceipt", [
      args.transactionId,
    ]).catch(() => null),
    readBnbErc20Value(args.tokenAddress, ERC20_DECIMALS_SELECTOR),
  ]);

  if (!transaction || !transaction.hash) {
    return {
      error: "Transaction not found on BNB Chain.",
      ok: false,
    };
  }

  if (!transaction.blockNumber) {
    return {
      error: "Transaction is still pending confirmation.",
      ok: false,
    };
  }

  if (!receipt || receipt.status !== "0x1") {
    return {
      error: "The BNB transaction failed or is missing a receipt.",
      ok: false,
    };
  }

  const expectedFrom = args.expectedFrom.toLowerCase();
  const expectedTarget = args.expectedTarget.toLowerCase();
  if (String(transaction.from || "").toLowerCase() !== expectedFrom) {
    return {
      error: "The BNB transfer sender does not match the profile owner wallet.",
      ok: false,
    };
  }

  const decimals = Number(parseHexToBigInt(rawDecimals || "0x12"));
  const requiredRaw = toRawTokenAmount(
    args.requiredTokenAmount,
    Number.isFinite(decimals) ? decimals : 18,
  );
  const normalizedTokenAddress = args.tokenAddress.toLowerCase();
  const matchedTransfer = (receipt.logs ?? []).find((log) => {
    const topics = log.topics ?? [];
    if (
      String(log.address || "").toLowerCase() !== normalizedTokenAddress ||
      topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC ||
      topics.length < 3
    ) {
      return false;
    }

    const fromTopic = `0x${stripHexPrefix(topics[1] || "").slice(-40)}`.toLowerCase();
    const toTopic = `0x${stripHexPrefix(topics[2] || "").slice(-40)}`.toLowerCase();
    const rawAmount = parseHexToBigInt(log.data || "0x0");

    return (
      fromTopic === expectedFrom &&
      toTopic === expectedTarget &&
      rawAmount >= requiredRaw
    );
  });

  if (!matchedTransfer) {
    return {
      error: `The BNB transfer must send at least ${args.requiredTokenAmount} $CAMIUP to ${expectedTarget}.`,
      ok: false,
    };
  }

  return {
    ok: true,
    transactionId: transaction.hash,
    verifiedWallet: expectedFrom,
  };
}
