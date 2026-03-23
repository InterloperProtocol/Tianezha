import { randomUUID } from "crypto";

import { PublicKey } from "@solana/web3.js";

import { getPublicEnv, getServerEnv } from "@/lib/env";
import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import { fetchWalletAnalytics } from "@/lib/server/goonclaw-smart-wallets";
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
  listRecoverableSessions,
  upsertLivestreamRequest,
} from "@/lib/server/repository";
import {
  PUBLIC_LIVESTREAM_DEVICE_ID,
  PUBLIC_LIVESTREAM_OWNER_ID,
} from "@/lib/server/runtime-constants";
import {
  createDedicatedPaymentAddress,
  sweepDedicatedPaymentToTreasury,
  verifyMemoTransferToTreasury,
  verifyTransferToAddress,
} from "@/lib/server/solana";
import {
  LivestreamRequestRecord,
  SessionRecord,
  LivestreamTier,
} from "@/lib/types";
import { nowIso } from "@/lib/utils";

const PAYMENT_WINDOW_MS = 15 * 60_000;
const LIVESTREAM_MEMO_PREFIX = "PUMP";
const MINIMUM_GUARANTEED_DISPLAY_MS = 120_000;
const PREEMPT_COOLDOWN_MS = 120_000;

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

function isLegacyTreasuryMemoRequest(request: LivestreamRequestRecord) {
  return (
    request.paymentRouting === "treasury_memo" ||
    (!request.paymentAddress && !request.paymentSecretCiphertext)
  );
}

function isRequestReadyForActivation(request: LivestreamRequestRecord) {
  if (request.status !== "pending" || !request.signature) {
    return false;
  }

  if (request.sweepStatus === "swept") {
    return true;
  }

  return isLegacyTreasuryMemoRequest(request) && Boolean(request.paymentConfirmedAt);
}

function getActivationQueue(
  requests: LivestreamRequestRecord[],
) {
  return [...requests]
    .filter(isRequestReadyForActivation)
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
    !request.paymentConfirmedAt &&
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

function getDefaultPublicLivestreamContractAddress() {
  return getServerEnv().BAGSTROKE_TOKEN_MINT || DEFAULT_PUMP_TOKEN_MINT;
}

function matchesPublicLivestreamSession(session: SessionRecord) {
  return (
    session.wallet === PUBLIC_LIVESTREAM_OWNER_ID &&
    session.deviceId === PUBLIC_LIVESTREAM_DEVICE_ID &&
    (session.status === "active" || session.status === "starting")
  );
}

async function getCurrentPublicLivestreamSession() {
  const sessions = await listRecoverableSessions();
  return sessions.find(matchesPublicLivestreamSession) ?? null;
}

async function startOrReusePublicLivestreamSession(contractAddress: string) {
  const existing = await getCurrentPublicLivestreamSession();
  const normalizedContractAddress = assertContractAddress(contractAddress);

  if (
    existing &&
    existing.contractAddress === normalizedContractAddress &&
    existing.mode === "live"
  ) {
    return existing;
  }

  if (existing) {
    await dispatchSessionStop(existing.id).catch(() => null);
  }

  return dispatchSessionStart({
    wallet: PUBLIC_LIVESTREAM_OWNER_ID,
    contractAddress: normalizedContractAddress,
    deviceId: PUBLIC_LIVESTREAM_DEVICE_ID,
    mode: "live",
  });
}

async function ensureIdlePublicLivestreamSession() {
  if (!getServerEnv().PUBLIC_AUTOBLOW_DEVICE_TOKEN) {
    return null;
  }

  return startOrReusePublicLivestreamSession(
    getDefaultPublicLivestreamContractAddress(),
  );
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

async function shouldTreatRequestAsFinished(request: LivestreamRequestRecord) {
  const session = request.sessionId ? await getSession(request.sessionId) : null;
  const expiresAtMs = request.expiresAt ? new Date(request.expiresAt).getTime() : 0;
  const expiredByTime = expiresAtMs > 0 && expiresAtMs <= Date.now();
  const sessionEnded =
    !session || session.status === "stopped" || session.status === "error";

  return expiredByTime || sessionEnded;
}

function canPriorityPreempt(request: LivestreamRequestRecord) {
  if (request.tier !== "standard") {
    return false;
  }

  const displayStartedAtMs = request.displayStartedAt
    ? new Date(request.displayStartedAt).getTime()
    : request.activatedAt
      ? new Date(request.activatedAt).getTime()
      : 0;
  if (!displayStartedAtMs) {
    return false;
  }

  const guaranteedAt = displayStartedAtMs + MINIMUM_GUARANTEED_DISPLAY_MS;
  const cooldownUntil = request.preemptCooldownUntil
    ? new Date(request.preemptCooldownUntil).getTime()
    : 0;

  return Date.now() >= Math.max(guaranteedAt, cooldownUntil);
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

  if (active && priorityWaiting && canPriorityPreempt(active)) {
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
        const activatedAt = nowIso();
        const session = await startOrReusePublicLivestreamSession(
          next.contractAddress,
        );

        active = await upsertLivestreamRequest({
          ...next,
          status: "active",
          updatedAt: activatedAt,
          activatedAt,
          displayStartedAt: activatedAt,
          preemptCooldownUntil:
            next.tier === "priority"
              ? new Date(Date.now() + PREEMPT_COOLDOWN_MS).toISOString()
              : next.preemptCooldownUntil,
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
    } else {
      await ensureIdlePublicLivestreamSession().catch(() => null);
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
    paymentAddress: request.paymentAddress,
    paymentRouting: request.paymentRouting,
    receivedLamports: request.receivedLamports,
    paymentConfirmedAt: request.paymentConfirmedAt,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    activatedAt: request.activatedAt,
    displayStartedAt: request.displayStartedAt,
    preemptCooldownUntil: request.preemptCooldownUntil,
    expiresAt: request.expiresAt,
    completedAt: request.completedAt,
    payerWallet: request.payerWallet,
    sessionId: request.sessionId,
    walletMemo: request.walletMemo,
    walletSummary: request.walletSummary,
    sweepStatus: request.sweepStatus,
    sweepSignature: request.sweepSignature,
    sweptLamports: request.sweptLamports,
    lastSweepAt: request.lastSweepAt,
    sweepError: request.sweepError,
    error: request.error,
  };
}

export async function getLivestreamState(guestId?: string | null) {
  await syncLivestreamQueue();

  const env = getServerEnv();
  const publicEnv = getPublicEnv();
  const [requests, recent] = await Promise.all([
    listLivestreamRequests(),
    guestId ? listLivestreamRequestsForGuest(guestId, 5) : Promise.resolve([]),
  ]);

  const persistedCurrent =
    requests.find((request) => request.status === "active") ?? null;
  const currentFinished = persistedCurrent
    ? await shouldTreatRequestAsFinished(persistedCurrent)
    : false;
  const current = currentFinished ? null : persistedCurrent;
  const queue = getActivationQueue(requests).filter((request) => {
    if (request.id === persistedCurrent?.id) {
      return false;
    }

    return true;
  });
  const priorityWaiting = queue.find((request) => request.tier === "priority") || null;
  const guaranteedAt =
    current?.displayStartedAt || current?.activatedAt
      ? new Date(
          new Date(current.displayStartedAt || current.activatedAt || current.createdAt).getTime() +
            MINIMUM_GUARANTEED_DISPLAY_MS,
        ).toISOString()
      : null;
  const preemptEligibleAt =
    current && priorityWaiting
      ? (() => {
          const timestamps = [guaranteedAt, current.preemptCooldownUntil || null]
            .filter((value): value is string => Boolean(value))
            .map((value) => new Date(value).getTime());

          if (!timestamps.length) {
            return null;
          }

          return new Date(Math.max(...timestamps)).toISOString();
        })()
      : null;

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
    kernel: {
      minimumGuaranteedDisplaySeconds: Math.floor(
        MINIMUM_GUARANTEED_DISPLAY_MS / 1000,
      ),
      preemptCooldownSeconds: Math.floor(PREEMPT_COOLDOWN_MS / 1000),
      preemptEligibleAt,
      priorityWaiting: Boolean(priorityWaiting),
    },
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
  const payment = createDedicatedPaymentAddress();
  const request: LivestreamRequestRecord = {
    id: randomUUID(),
    guestId,
    contractAddress: normalizedContractAddress,
    memo: await generateUniqueMemo(),
    tier,
    amountLamports: getTierPriceLamports(tier).toString(),
    paymentAddress: payment.paymentAddress,
    paymentRouting: "dedicated_address",
    paymentSecretCiphertext: payment.paymentSecretCiphertext,
    receivedLamports: "0",
    sweepStatus: "pending",
    sweptLamports: "0",
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

  if (isRequestReadyForActivation(request)) {
    throw new Error("This request is already paid and queued.");
  }

  if (isPaymentWindowExpired(request)) {
    await upsertLivestreamRequest({
      ...request,
      status: "expired",
      updatedAt: nowIso(),
      completedAt: nowIso(),
      error: "Payment window expired",
    });
    throw new Error("This payment window expired. Generate a new payment address.");
  }

  const duplicateSignature = await getLivestreamRequestBySignature(signature);
  if (duplicateSignature && duplicateSignature.id !== request.id) {
    throw new Error("That transaction signature is already tied to another request");
  }

  const legacyTreasuryMemoRequest = isLegacyTreasuryMemoRequest(request);
  const verification = legacyTreasuryMemoRequest
    ? await verifyMemoTransferToTreasury(
        signature,
        BigInt(request.amountLamports),
        request.memo,
      )
    : await (() => {
        if (!request.paymentAddress || !request.paymentSecretCiphertext) {
          throw new Error("This request is missing its dedicated payment wallet.");
        }

        return verifyTransferToAddress(
          signature,
          BigInt(request.amountLamports),
          request.paymentAddress,
        );
      })();
  if (!verification.ok) {
    throw new Error(verification.error || "Payment verification failed");
  }

  const walletAnalytics = verification.payerWallet
    ? await fetchWalletAnalytics(verification.payerWallet)
    : null;
  const paymentConfirmedAt = nowIso();
  const verifiedRequest: LivestreamRequestRecord = {
    ...request,
    updatedAt: paymentConfirmedAt,
    signature,
    payerWallet: verification.payerWallet,
    receivedLamports: verification.lamports.toString(),
    paymentConfirmedAt,
    paymentRouting: legacyTreasuryMemoRequest
      ? "treasury_memo"
      : request.paymentRouting || "dedicated_address",
    walletMemo: walletAnalytics?.walletMemo || null,
    walletSummary: walletAnalytics?.narrativeSummary || null,
    sweepError: undefined,
    error: undefined,
  };

  if (legacyTreasuryMemoRequest) {
    await upsertLivestreamRequest({
      ...verifiedRequest,
      sweepStatus: "swept",
      sweptLamports: verification.lamports.toString(),
      lastSweepAt: paymentConfirmedAt,
    });

    await syncLivestreamQueue();
    return getLivestreamRequest(request.id);
  }

  await upsertLivestreamRequest({
    ...verifiedRequest,
    sweepStatus: "pending",
  });

  let sweep;
  try {
    sweep = await sweepDedicatedPaymentToTreasury({
      paymentSecretCiphertext: request.paymentSecretCiphertext!,
      expectedMinimumLamports: verification.lamports,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to sweep the dedicated payment wallet.";
    await upsertLivestreamRequest({
      ...verifiedRequest,
      sweepStatus: "failed",
      sweptLamports: request.sweptLamports || "0",
      sweepError: message,
      error: message,
    });
    throw new Error(message);
  }

  if (!sweep.ok) {
    const message = sweep.error || "Failed to sweep the dedicated payment wallet.";
    await upsertLivestreamRequest({
      ...verifiedRequest,
      sweepStatus: "failed",
      sweptLamports: sweep.sweptLamports.toString(),
      sweepError: message,
      error: message,
    });
    throw new Error(message);
  }

  await upsertLivestreamRequest({
    ...verifiedRequest,
    sweepStatus: "swept",
    sweepSignature: sweep.sweepSignature,
    sweptLamports: sweep.sweptLamports.toString(),
    lastSweepAt: paymentConfirmedAt,
    sweepError: undefined,
  });

  await syncLivestreamQueue();
  return getLivestreamRequest(request.id);
}
