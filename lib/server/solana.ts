import bs58 from "bs58";
import {
  Connection,
  LAMPORTS_PER_SOL,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";

import { getServerEnv } from "@/lib/env";

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

function getConnection() {
  return new Connection(getServerEnv().SOLANA_RPC_URL, "confirmed");
}

export async function getWalletSolBalance(wallet: string) {
  try {
    const connection = getConnection();
    const lamports = await connection.getBalance(new PublicKey(wallet), "confirmed");
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return null;
  }
}

function collectParsedInstructions(transaction: ParsedTransactionWithMeta | null) {
  if (!transaction) return [] as ParsedInstruction[];

  const parsed: ParsedInstruction[] = [];
  for (const instruction of transaction.transaction.message.instructions) {
    if ("parsed" in instruction) {
      parsed.push(instruction as ParsedInstruction);
    }
  }

  for (const inner of transaction.meta?.innerInstructions ?? []) {
    for (const instruction of inner.instructions) {
      if ("parsed" in instruction) {
        parsed.push(instruction as ParsedInstruction);
      }
    }
  }

  return parsed;
}

function collectAllInstructions(transaction: ParsedTransactionWithMeta | null) {
  if (!transaction) {
    return [] as Array<ParsedInstruction | PartiallyDecodedInstruction>;
  }

  const items: Array<ParsedInstruction | PartiallyDecodedInstruction> = [
    ...transaction.transaction.message.instructions,
  ];
  for (const inner of transaction.meta?.innerInstructions ?? []) {
    items.push(...inner.instructions);
  }
  return items;
}

function parseAmountToBigInt(value: unknown) {
  if (typeof value === "string") return BigInt(value);
  if (typeof value === "number") return BigInt(Math.floor(value));
  return BigInt(0);
}

function decodeMemo(instruction: ParsedInstruction | PartiallyDecodedInstruction) {
  if ("parsed" in instruction) {
    const parsed = instruction.parsed;
    if (typeof parsed === "string") {
      return parsed;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "memo" in parsed &&
      typeof parsed.memo === "string"
    ) {
      return parsed.memo;
    }
    return null;
  }

  const programId = instruction.programId.toBase58();
  if (programId !== MEMO_PROGRAM_ID) {
    return null;
  }

  try {
    return Buffer.from(bs58.decode(instruction.data)).toString("utf8");
  } catch {
    return null;
  }
}

export async function verifyTransferToTreasury(signature: string, wallet: string) {
  const env = getServerEnv();
  const connection = getConnection();
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction || transaction.meta?.err) {
    return { ok: false, lamports: BigInt(0), error: "Transaction not confirmed" };
  }

  const instructions = collectParsedInstructions(transaction);
  const treasury = env.TREASURY_WALLET;
  const walletKey = new PublicKey(wallet).toBase58();
  let matchedLamports = BigInt(0);

  for (const instruction of instructions) {
    if (instruction.program !== "system") continue;
    const parsed = instruction.parsed as { type?: string; info?: Record<string, unknown> };
    if (parsed.type !== "transfer" || !parsed.info) continue;

    const from = String(parsed.info.source ?? "");
    const to = String(parsed.info.destination ?? "");
    const lamports = parseAmountToBigInt(parsed.info.lamports);

    if (from === walletKey && to === treasury) {
      matchedLamports += lamports;
    }
  }

  if (matchedLamports <= 0) {
    return { ok: false, lamports: BigInt(0), error: "No treasury transfer found" };
  }

  return { ok: true, lamports: matchedLamports };
}

export async function verifyMemoTransferToTreasury(
  signature: string,
  expectedLamports: bigint,
  expectedMemo: string,
) {
  const env = getServerEnv();
  const connection = getConnection();
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction || transaction.meta?.err) {
    return {
      ok: false,
      lamports: BigInt(0),
      error: "Transaction not confirmed",
    };
  }

  const parsedInstructions = collectParsedInstructions(transaction);
  const allInstructions = collectAllInstructions(transaction);
  const treasury = env.TREASURY_WALLET;
  let matchedLamports = BigInt(0);
  let payerWallet = "";

  for (const instruction of parsedInstructions) {
    if (instruction.program !== "system") continue;
    const parsed = instruction.parsed as { type?: string; info?: Record<string, unknown> };
    if (parsed.type !== "transfer" || !parsed.info) continue;

    const from = String(parsed.info.source ?? "");
    const to = String(parsed.info.destination ?? "");
    const lamports = parseAmountToBigInt(parsed.info.lamports);

    if (to === treasury) {
      matchedLamports += lamports;
      payerWallet ||= from;
    }
  }

  if (matchedLamports !== expectedLamports) {
    return {
      ok: false,
      lamports: matchedLamports,
      error: `Expected exact payment of ${expectedLamports.toString()} lamports`,
    };
  }

  const memoFound = allInstructions.some((instruction) => {
    const memo = decodeMemo(instruction);
    return memo === expectedMemo;
  });

  if (!memoFound) {
    return {
      ok: false,
      lamports: matchedLamports,
      error: "Transaction memo does not match the generated memo",
    };
  }

  return {
    ok: true,
    lamports: matchedLamports,
    payerWallet,
  };
}

export async function verifyBurnSignature(signature: string, wallet: string) {
  const env = getServerEnv();
  const connection = getConnection();
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction || transaction.meta?.err) {
    return { ok: false, amount: BigInt(0), error: "Burn transaction not confirmed" };
  }

  const instructions = collectParsedInstructions(transaction);
  const expectedMint = env.BAGSTROKE_TOKEN_MINT;
  const expectedAmount = BigInt(env.BAGSTROKE_BURN_AMOUNT_RAW);
  let burnedAmount = BigInt(0);

  for (const instruction of instructions) {
    if (instruction.program !== "spl-token") continue;
    const parsed = instruction.parsed as { type?: string; info?: Record<string, unknown> };
    if (!parsed.info) continue;

    if (parsed.type !== "burn" && parsed.type !== "burnChecked") continue;

    const authority = String(parsed.info.authority ?? "");
    const mint = String(parsed.info.mint ?? "");
    const amount = parseAmountToBigInt(
      parsed.info.amount ??
        (parsed.info.tokenAmount as { amount?: string } | undefined)?.amount,
    );

    if (authority === wallet && mint === expectedMint) {
      burnedAmount += amount;
    }
  }

  if (burnedAmount !== expectedAmount) {
    return {
      ok: false,
      amount: burnedAmount,
      error: `Expected exact burn of ${expectedAmount.toString()} raw units`,
    };
  }

  return { ok: true, amount: burnedAmount };
}

export async function walletOwnsAccessCnft(wallet: string) {
  const env = getServerEnv();
  if (!env.HELIUS_API_KEY || !env.ACCESS_CNFT_COLLECTION) return false;

  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "goonclaw-get-assets-by-owner",
          method: "getAssetsByOwner",
          params: {
            ownerAddress: wallet,
            page,
            limit: 250,
          },
        }),
      },
    );

    if (!response.ok) return false;

    const payload = (await response.json()) as {
      result?: {
        items?: Array<{
          id: string;
          grouping?: Array<{ group_key: string; group_value: string }>;
        }>;
      };
    };

    const items = payload.result?.items ?? [];
    if (
      items.some((item) =>
        item.grouping?.some(
          (group) =>
            group.group_key === "collection" &&
            group.group_value === env.ACCESS_CNFT_COLLECTION,
        ),
      )
    ) {
      return true;
    }

    if (items.length < 250) {
      return false;
    }
  }

  return false;
}
