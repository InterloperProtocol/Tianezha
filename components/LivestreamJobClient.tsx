"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PriceChart } from "@/components/PriceChart";
import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

type LivestreamRequestView = {
  id: string;
  contractAddress: string;
  memo: string;
  tier: "standard" | "priority";
  amountLamports: string;
  paymentAddress?: string;
  paymentRouting?: string;
  receivedLamports?: string;
  paymentConfirmedAt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  expiresAt?: string;
  completedAt?: string;
  payerWallet?: string;
  sessionId?: string;
  sweepStatus?: string;
  sweepSignature?: string;
  sweptLamports?: string;
  lastSweepAt?: string;
  sweepError?: string;
  error?: string;
};

type LivestreamState = {
  current: LivestreamRequestView | null;
  queue: LivestreamRequestView[];
  recentRequests: LivestreamRequestView[];
  treasuryWallet: string;
  standardPriceSol: string;
  priorityPriceSol: string;
  sessionSeconds: number;
  paymentWindowSeconds: number;
};

function shortenValue(value?: string | null) {
  if (!value) return "Waiting";
  if (value.length < 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function lamportsToSol(value: string) {
  const sol = Number(BigInt(value)) / 1_000_000_000;
  return sol.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function lamportsToSolFromOptional(value?: string) {
  if (!value) return "0";
  return lamportsToSol(value);
}

function resolveRequest(state: LivestreamState | null, requestId: string) {
  if (!state) return null;

  const candidates = [
    state.current,
    ...state.queue,
    ...state.recentRequests,
  ].filter((item): item is LivestreamRequestView => Boolean(item));

  return candidates.find((item) => item.id === requestId) ?? null;
}

export function LivestreamJobClient({ requestId }: { requestId: string }) {
  const [livestreamState, setLivestreamState] = useState<LivestreamState | null>(null);
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshLivestreamState = useCallback(async () => {
    const response = await fetch("/api/livestream/status");
    const payload = (await response.json()) as LivestreamState & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Couldn't load job status");
    }

    setLivestreamState(payload);
  }, []);

  useEffect(() => {
    void refreshLivestreamState();

    const interval = window.setInterval(() => {
      void refreshLivestreamState().catch(() => null);
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [refreshLivestreamState]);

  const request = useMemo(
    () => resolveRequest(livestreamState, requestId),
    [livestreamState, requestId],
  );
  const queuePosition = useMemo(() => {
    if (!request || !livestreamState) return null;
    const index = livestreamState.queue.findIndex((item) => item.id === request.id);
    return index >= 0 ? index + 1 : null;
  }, [livestreamState, request]);
  const checkoutPriceSol = useMemo(
    () => (request ? lamportsToSol(request.amountLamports) : ""),
    [request],
  );
  const checkoutReceivedSol = useMemo(
    () => lamportsToSolFromOptional(request?.receivedLamports),
    [request?.receivedLamports],
  );
  const sessionMinutes = useMemo(
    () =>
      livestreamState?.sessionSeconds
        ? Math.max(1, Math.round(livestreamState.sessionSeconds / 60))
        : 2,
    [livestreamState?.sessionSeconds],
  );
  const needsPaymentConfirmation = request?.status === "pending" && !request?.payerWallet;

  async function verifyLivestreamCheckout() {
    if (!request || !signature.trim()) {
      return;
    }

    setLoading("livestream-verify");
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/livestream/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          signature: signature.trim(),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        state?: LivestreamState;
      };

      if (!response.ok || !payload.state) {
        throw new Error(payload.error || "Couldn't confirm payment");
      }

      setLivestreamState(payload.state);
      setNotice(
        "Payment confirmed and swept to the Tianshi revenue wallet. Your chart job is now in the session queue.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't confirm payment",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="app-shell">
      <SiteNav />

      <RouteHeader
        eyebrow="Open job"
        title="Chart job page"
        summary="Track a pending or active chart job without changing the flagship room chart before payment clears."
        badges={[
          request?.tier === "priority" ? "Priority job" : "Standard job",
          request?.status || "Waiting",
          "Guest session",
        ]}
      />

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      {request ? (
        <>
          <section className="dashboard-grid dashboard-grid-primary-row">
            <PriceChart contractAddress={request.contractAddress} />

            <section className="panel room-economy-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Open job</p>
                  <h2>{request.tier === "priority" ? "Priority" : "Standard"} request</h2>
                </div>
                <div className="source-pill">{request.status}</div>
              </div>

              <div className="room-economy-scroll">
                <div className="history-list">
                  <div className="history-item">
                    <div>
                      <span>Chart</span>
                      <strong>{request.contractAddress}</strong>
                    </div>
                    <div>
                      <span>Amount</span>
                      <strong>{checkoutPriceSol} SOL</strong>
                    </div>
                  </div>
                  <div className="history-item">
                    <div>
                      <span>Payment address</span>
                      <strong>{request.paymentAddress || "Waiting"}</strong>
                    </div>
                    <div>
                      <span>Revenue wallet</span>
                      <strong>{shortenValue(livestreamState?.treasuryWallet)}</strong>
                    </div>
                  </div>
                  <div className="history-item">
                    <div>
                      <span>Received</span>
                      <strong>{checkoutReceivedSol} SOL</strong>
                    </div>
                    <div>
                      <span>Sweep</span>
                      <strong>{request.sweepStatus || "Pending"}</strong>
                    </div>
                  </div>
                  <div className="history-item">
                    <div>
                      <span>Session time</span>
                      <strong>{sessionMinutes} minutes</strong>
                    </div>
                    <div>
                      <span>Payment window</span>
                      <strong>{livestreamState?.paymentWindowSeconds || 900} sec</strong>
                    </div>
                  </div>
                </div>

                <div className="route-badges">
                  {queuePosition ? (
                    <StatusBadge tone="accent">Queue #{queuePosition}</StatusBadge>
                  ) : null}
                  {request.payerWallet ? (
                    <StatusBadge tone="success">Payment seen</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Awaiting payment</StatusBadge>
                  )}
                  {request.sessionId ? (
                    <StatusBadge tone="success">Live session linked</StatusBadge>
                  ) : null}
                </div>

                {needsPaymentConfirmation ? (
                  <>
                    <label className="field">
                      <span>Transaction signature</span>
                      <input
                        value={signature}
                        onChange={(event) => setSignature(event.target.value)}
                        placeholder="Paste the Solana signature after sending to the dedicated address"
                      />
                    </label>

                    <button
                      className="button button-primary"
                      disabled={loading === "livestream-verify" || !signature.trim()}
                      onClick={() => void verifyLivestreamCheckout()}
                      type="button"
                    >
                      {loading === "livestream-verify" ? "Confirming..." : "Confirm payment"}
                    </button>
                  </>
                ) : (
                  <p className="panel-lead">
                    This job is already paid or moving through the queue. The flagship
                    room chart stays locked to the currently paid live session until
                    this request actually activates.
                  </p>
                )}

                <div className="button-row">
                  <Link className="button button-secondary" href="/tianshi">
                    Back to Tianshi
                  </Link>
                </div>
              </div>
            </section>
          </section>
        </>
      ) : (
        <section className="panel">
          <p className="empty-state">
            This job could not be found in your current guest session. Open the job
            page from the same browser session that created the payment address.
          </p>
          <div className="button-row">
            <Link className="button button-secondary" href="/tianshi">
              Back to Tianshi
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
