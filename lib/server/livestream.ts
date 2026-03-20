import { randomUUID } from "crypto";

import { PublicKey } from "@solana/web3.js";

import { getPublicEnv, getServerEnv } from "@/lib/env";
import {
  dispatchSessionStart,
  dispatchSessionStop,
} from "@/lib/server/worker-client";
import {
  getLivestreamRequest,
  getLivestreamRequestByMemo,
  getLivestreamRequestBySignature,
  getSession,
  listLivestreamRequests,
  listLivestreamRequestsForGuest,
  upsertLivestreamRequest,
} from "@/lib/server/repository";
import {
  PUBLIC_LIVESTREAM_DEVICE_ID,
  PUBLIC_LIVESTREAM_OWNER_ID,
} from "@/lib/server/runtime-constants";
import { verifyMemoTransferToTreasury } from "@/lib/server/solana";
import {
  LivestreamRequestRecord,
  LivestreamTier,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";

const PAYMENT_WINDOW_MS = 15 * 60_000;
const LIVESTREAM_MEMO_PREFIX = "PUMP";

function toLamports(sol: string) {
  return BigInt(Math.round(Number(sol) * 1_000_000_000));
}

function getTierPriceLamports(tier: LivestreamTier) {
  const env = getServerEnv();
  return toLamports(
    tier === "priority"
      ? env.LIVESTREAM_PRIORITY_PRICE_SOL
      : env.LIVESTREAM_STANDARD_PRICE_SOL,
  );
}

function getActivationQueue(
  requests: LivestreamRequestRecord[],
) {
  return [...requests]
    .filter((request) => request.status === "pending" && request.signature)
    .sort((left, right) => {
      if (left.tier !== right.tier) {
        return left.tier === "priority" ? -1 : 1;
      }
      return left.createdAt.localeCompare(right.createdAt);
    });
}

function isPaymentWindowExpired(request: LivestreamRequestRecord) {
  return (
    request.status === "pending" &&
    !request.signature &&
    new Date(request.createdAt).getTime() + PAYMENT_WINDOW_MS < Date.now()
  );
}

function formatRemainingSeconds(targetIso?: string) {
  if (!targetIso) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(targetIso).getTime() - Date.now()) / 1000),
  );
}

function assertContractAddress(contractAddress: string) {
  try {
    return new PublicKey(contractAddress.trim()).toBase58();
  } catch {
    throw new Error("Enter a valid Solana contract address");
  }
}

async function generateUniqueMemo() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const memo = `${LIVESTREAM_MEMO_PREFIX}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const existing = await getLivestreamRequestByMemo(memo);
    if (!existing) {
      return memo;
    }
  }

  throw new Error("Failed to create a unique payment memo");
}

async function expireStaleRequests(requests: LivestreamRequestRecord[]) {
  await Promise.all(
    requests
      .filter(isPaymentWindowExpired)
      .map((request) =>
        upsertLivestreamRequest({
          ...request,
          status: "expired",
          updatedAt: nowIso(),
          completedAt: nowIso(),
          error: "Payment window expired",
        }),
      ),
  );
}

async function enforceLivestreamCooldowns(
  guestId: string,
  contractAddress: string,
) {
  const env = getServerEnv();
  const requesterCooldownMs =
    Number(env.LIVESTREAM_REQUESTER_COOLDOWN_SECONDS) * 1000;
  const contractCooldownMs =
    Number(env.LIVESTREAM_CONTRACT_COOLDOWN_SECONDS) * 1000;

  const [guestRequests, allRequests] = await Promise.all([
    listLivestreamRequestsForGuest(guestId, 5),
    listLivestreamRequests(),
  ]);

  const recentGuestRequest = guestRequests.find((request) => {
    if (request.status === "failed" || request.status === "expired") {
      return false;
    }
    return (
      new Date(request.createdAt).getTime() + requesterCooldownMs > Date.now()
    );
  });

  if (recentGuestRequest) {
    const availableAt = new Date(
      new Date(recentGuestRequest.createdAt).getTime() + requesterCooldownMs,
    ).toISOString();
    throw new Error(
      `Cooldown active. You can create another request in ${formatRemainingSeconds(
        availableAt,
      )} seconds.`,
    );
  }

  const recentContractRequest = allRequests.find((request) => {
    if (
      request.contractAddress !== contractAddress ||
      request.status === "failed" ||
      request.status === "expired"
    ) {
      return false;
    }

    const referenceTime = request.completedAt ?? request.activatedAt ?? request.createdAt;
    return new Date(referenceTime).getTime() + contractCooldownMs > Date.now();
  });

  if (recentContractRequest) {
    const referenceTime =
      recentContractRequest.completedAt ??
      recentContractRequest.activatedAt ??
      recentContractRequest.createdAt;
    const availableAt = new Date(
      new Date(referenceTime).getTime() + contractCooldownMs,
    ).toISOString();
    throw new Error(
      `That contract is cooling down for ${formatRemainingSeconds(
        availableAt,
      )} more seconds.`,
    );
  }
}

async function maybeFinishActiveRequest(request: LivestreamRequestRecord) {
  const session = request.sessionId ? await getSession(request.sessionId) : null;
  const expiresAtMs = request.expiresAt ? new Date(request.expiresAt).getTime() : 0;
  const expiredByTime = expiresAtMs > 0 && expiresAtMs <= Date.now();
  const sessionEnded =
    !session || session.status === "stopped" || session.status === "error";

  if (!expiredByTime && !sessionEnded) {
    return false;
  }

  if (
    request.sessionId &&
    session &&
    (session.status === "active" || session.status === "starting")
  ) {
    await dispatchSessionStop(request.sessionId).catch(() => null);
  }

  await upsertLivestreamRequest({
    ...request,
    status: expiredByTime ? "expired" : "completed",
    updatedAt: nowIso(),
    completedAt: nowIso(),
    error: session?.lastError,
  });
  return true;
}

async function preemptActiveRequest(request: LivestreamRequestRecord) {
  if (request.sessionId) {
    await dispatchSessionStop(request.sessionId).catch(() => null);
  }

  await upsertLivestreamRequest({
    ...request,
    status: "completed",
    updatedAt: nowIso(),
    completedAt: nowIso(),
  });
}

export async function syncLivestreamQueue() {
  const env = getServerEnv();
  let requests = await listLivestreamRequests();
  await expireStaleRequests(requests);
  requests = await listLivestreamRequests();

  let active =
    requests.find((request) => request.status === "active") ?? null;
  const activationQueue = getActivationQueue(requests);
  const priorityWaiting = activationQueue.find(
    (request) => request.tier === "priority",
  );

  if (active && priorityWaiting) {
    await preemptActiveRequest(active);
    active = null;
    requests = await listLivestreamRequests();
  }

  if (active) {
    const finished = await maybeFinishActiveRequest(active);
    if (finished) {
      active = null;
      requests = await listLivestreamRequests();
    }
  }

  if (!active && env.PUBLIC_AUTOBLOW_DEVICE_TOKEN) {
    const next = getActivationQueue(requests)[0];
    if (next) {
      try {
        const session = await dispatchSessionStart({
          wallet: PUBLIC_LIVESTREAM_OWNER_ID,
          contractAddress: next.contractAddress,
          deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
          mode: "live",
        });

        active = await upsertLivestreamRequest({
          ...next,
          status: "active",
          updatedAt: nowIso(),
          activatedAt: nowIso(),
          expiresAt: new Date(
            Date.now() + Number(env.LIVESTREAM_SESSION_SECONDS) * 1000,
          ).toISOString(),
          sessionId: session.id,
        });
      } catch (error) {
        await upsertLivestreamRequest({
          ...next,
          status: "failed",
          updatedAt: nowIso(),
          completedAt: nowIso(),
          error:
            error instanceof Error ? error.message : "Failed to start queue item",
        });
      }
    }
  }
}

function serializeLivestreamRequest(request: LivestreamRequestRecord) {
  return {
    id: request.id,
    contractAddress: request.contractAddress,
    memo: request.memo,
    tier: request.tier,
    amountLamports: request.amountLamports,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    activatedAt: request.activatedAt,
    expiresAt: request.expiresAt,
    completedAt: request.completedAt,
    payerWallet: request.payerWallet,
    sessionId: request.sessionId,
    error: request.error,
  };
}

export async function getLivestreamState(guestId: string) {
  await syncLivestreamQueue();

  const env = getServerEnv();
  const publicEnv = getPublicEnv();
  const [requests, recent] = await Promise.all([
    listLivestreamRequests(),
    listLivestreamRequestsForGuest(guestId, 5),
  ]);

  const current =
    requests.find((request) => request.status === "active") ?? null;
  const queue = getActivationQueue(requests).filter(
    (request) => request.id !== current?.id,
  );

  return {
    current: current ? serializeLivestreamRequest(current) : null,
    queue: queue.map(serializeLivestreamRequest),
    recentRequests: recent.map(serializeLivestreamRequest),
    treasuryWallet: env.TREASURY_WALLET,
    standardPriceSol: env.LIVESTREAM_STANDARD_PRICE_SOL,
    priorityPriceSol: env.LIVESTREAM_PRIORITY_PRICE_SOL,
    sessionSeconds: Number(env.LIVESTREAM_SESSION_SECONDS),
    requesterCooldownSeconds: Number(env.LIVESTREAM_REQUESTER_COOLDOWN_SECONDS),
    contractCooldownSeconds: Number(env.LIVESTREAM_CONTRACT_COOLDOWN_SECONDS),
    paymentWindowSeconds: Math.floor(PAYMENT_WINDOW_MS / 1000),
    embedUrl: publicEnv.NEXT_PUBLIC_LIVESTREAM_EMBED_URL,
    deviceAvailable: Boolean(env.PUBLIC_AUTOBLOW_DEVICE_TOKEN),
  };
}

export async function createLivestreamRequest(
  guestId: string,
  contractAddress: string,
  tier: LivestreamTier,
) {
  const normalizedContractAddress = assertContractAddress(contractAddress);
  if (!getServerEnv().PUBLIC_AUTOBLOW_DEVICE_TOKEN) {
    throw new Error("The public Autoblow device is not configured yet");
  }
  await syncLivestreamQueue();
  await enforceLivestreamCooldowns(guestId, normalizedContractAddress);

  const env = getServerEnv();
  const activeQueue = getActivationQueue(await listLivestreamRequests());
  if (activeQueue.length >= Number(env.LIVESTREAM_MAX_QUEUE_LENGTH)) {
    throw new Error("The public queue is full right now. Try again shortly.");
  }

  const timestamp = nowIso();
  const request: LivestreamRequestRecord = {
    id: randomUUID(),
    guestId,
    contractAddress: normalizedContractAddress,
    memo: await generateUniqueMemo(),
    tier,
    amountLamports: getTierPriceLamports(tier).toString(),
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return upsertLivestreamRequest(request);
}

export async function verifyLivestreamRequestPayment(
  guestId: string,
  requestId: string,
  signature: string,
) {
  const request = await getLivestreamRequest(requestId);
  if (!request || request.guestId !== guestId) {
    throw new Error("Livestream request not found");
  }

  if (request.status !== "pending") {
    throw new Error("This request can no longer be paid");
  }

  if (isPaymentWindowExpired(request)) {
    await upsertLivestreamRequest({
      ...request,
      status: "expired",
      updatedAt: nowIso(),
      completedAt: nowIso(),
      error: "Payment window expired",
    });
    throw new Error("This payment memo expired. Generate a new request.");
  }

  const duplicateSignature = await getLivestreamRequestBySignature(signature);
  if (duplicateSignature && duplicateSignature.id !== request.id) {
    throw new Error("That transaction signature is already tied to another request");
  }

  const verification = await verifyMemoTransferToTreasury(
    signature,
    BigInt(request.amountLamports),
    request.memo,
  );
  if (!verification.ok) {
    throw new Error(verification.error || "Payment verification failed");
  }

  await upsertLivestreamRequest({
    ...request,
    updatedAt: nowIso(),
    signature,
    payerWallet: verification.payerWallet,
  });

  await syncLivestreamQueue();
  return getLivestreamRequest(request.id);
}
