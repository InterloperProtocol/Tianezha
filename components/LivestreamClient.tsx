"use client";

import { useEffect, useMemo, useState } from "react";

import { MediaEmbedPanel } from "@/components/MediaEmbedPanel";
import { NewsPanel } from "@/components/NewsPanel";
import { PriceChart } from "@/components/PriceChart";
import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import { ChartSnapshot, LivestreamTier } from "@/lib/types";

type LivestreamRequestView = {
  id: string;
  contractAddress: string;
  memo: string;
  tier: LivestreamTier;
  amountLamports: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  expiresAt?: string;
  completedAt?: string;
  payerWallet?: string;
  sessionId?: string;
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
  requesterCooldownSeconds: number;
  contractCooldownSeconds: number;
  paymentWindowSeconds: number;
  embedUrl: string;
  deviceAvailable: boolean;
};

const DEFAULT_CONTRACT_ADDRESS = DEFAULT_PUMP_TOKEN_MINT;

function lamportsToSol(value: string) {
  return (Number(BigInt(value)) / 1_000_000_000).toFixed(3);
}

function shorten(value?: string) {
  if (!value) return "";
  if (value.length < 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function LivestreamClient() {
  const [state, setState] = useState<LivestreamState | null>(null);
  const [chartSnapshot, setChartSnapshot] = useState<ChartSnapshot | null>(null);
  const [contractAddress, setContractAddress] = useState("");
  const [tier, setTier] = useState<LivestreamTier>("standard");
  const [signature, setSignature] = useState("");
  const [checkout, setCheckout] = useState<LivestreamRequestView | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshState() {
    const response = await fetch("/api/livestream/status");
    if (!response.ok) return;

    const payload = (await response.json()) as LivestreamState;
    setState(payload);
    setCheckout((current) =>
      current
        ? payload.recentRequests.find((item) => item.id === current.id) ?? current
        : payload.recentRequests.find(
            (item) => item.status === "pending" && !item.payerWallet,
          ) ?? null,
    );
  }

  useEffect(() => {
    void refreshState();
    const interval = window.setInterval(() => {
      void refreshState();
    }, 8_000);
    return () => window.clearInterval(interval);
  }, []);

  const checkoutPrice = useMemo(() => {
    if (!checkout) return "";
    return lamportsToSol(checkout.amountLamports);
  }, [checkout]);

  const focusContractAddress =
    state?.current?.contractAddress ||
    checkout?.contractAddress ||
    contractAddress.trim() ||
    DEFAULT_CONTRACT_ADDRESS;

  async function createRequest() {
    setLoading("request");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/livestream/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: contractAddress.trim(),
          tier,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        item?: LivestreamRequestView;
        state?: LivestreamState;
      };
      if (!response.ok || !payload.item || !payload.state) {
        throw new Error(payload.error || "Failed to create payment memo");
      }

      setCheckout(payload.item);
      setState(payload.state);
      setSignature("");
      setNotice(
        "Memo generated. Pay from any Solana wallet, then paste the transaction signature below.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to create payment memo",
      );
    } finally {
      setLoading(null);
    }
  }

  async function verifyPayment() {
    if (!checkout) return;

    setLoading("verify");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/livestream/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: checkout.id,
          signature: signature.trim(),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        item?: LivestreamRequestView | null;
        state?: LivestreamState;
      };
      if (!response.ok || !payload.state) {
        throw new Error(payload.error || "Failed to verify payment");
      }

      setState(payload.state);
      setCheckout(payload.item ?? checkout);
      setNotice(
        "Payment verified. If the public device is free, your contract will start right away.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to verify payment",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="app-shell">
      <SiteNav />
      <RouteHeader
        eyebrow="Public room"
        title="Make queue state obvious and trustworthy."
        summary="The livestream surface prioritizes public clarity: stream context up top, payment and request controls below, and current queue state visible before a user pays."
        badges={[
          "Public clarity",
          "Request trust",
          `Standard ${state?.standardPriceSol ?? "0.001"} SOL`,
          `Priority ${state?.priorityPriceSol ?? "0.01"} SOL`,
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Device state</p>
              <strong>{state?.deviceAvailable ? "Available" : "Busy or offline"}</strong>
              <span>Public users should know if the shared device can take control.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Queue depth</p>
              <strong>{state?.queue.length ?? 0} waiting</strong>
              <span>Queue visibility reduces uncertainty and duplicate requests.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Current request</p>
              <strong>{state?.current ? shorten(state.current.contractAddress) : "No active request"}</strong>
              <span>Live status stays near the request controls.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Payment window</p>
              <strong>{state?.paymentWindowSeconds ?? 900} sec</strong>
              <span>Memo verification timeout is explicit before users act.</span>
            </div>
          </div>
        }
      />

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="dashboard-grid dashboard-grid-triple">
        <PriceChart
          contractAddress={focusContractAddress}
          onSnapshotChange={setChartSnapshot}
        />
        <NewsPanel
          title={`${chartSnapshot?.symbol ?? "Solana"} news`}
          defaultCategory="solana"
        />
        <MediaEmbedPanel
          title="Video embed"
          description="This panel uses NEXT_PUBLIC_LIVESTREAM_EMBED_URL when configured, but you can also preview another embed locally while building."
          defaultUrl={state?.embedUrl || ""}
          storageKey="goonclaw-livestream-media"
        />
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Device Control</p>
              <h2>Request shared control</h2>
            </div>
          </div>

          <p className="hero-summary compact">
            Generate a memo, pay from any Solana wallet, then paste the confirmed
            signature to unlock a control slot.
          </p>

          <label className="field">
            <span>Contract address</span>
            <input
              value={contractAddress}
              onChange={(event) => setContractAddress(event.target.value)}
              placeholder="Enter a Solana contract address"
            />
          </label>

          <div className="field-grid">
            <button
              className={
                tier === "standard"
                  ? "button button-primary"
                  : "button button-ghost"
              }
              onClick={() => setTier("standard")}
              type="button"
            >
              Standard
            </button>
            <button
              className={
                tier === "priority"
                  ? "button button-danger"
                  : "button button-ghost"
              }
              onClick={() => setTier("priority")}
              type="button"
            >
              Priority
            </button>
          </div>

          <div className="button-row">
            <button
              className="button button-secondary"
              disabled={loading === "request"}
              onClick={() => void createRequest()}
            >
              {loading === "request" ? "Generating..." : "Generate memo"}
            </button>
          </div>

          {checkout ? (
            <div className="checkout-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Payment details</p>
                  <h2>
                    {checkout.tier === "priority" ? "Priority" : "Standard"} request
                  </h2>
                </div>
                <div className="source-pill">
                  <span className="status-dot" />
                  {checkout.status}
                </div>
              </div>

              <div className="history-list">
                <div className="history-item">
                  <div>
                    <span>Amount</span>
                    <strong>{checkoutPrice} SOL</strong>
                  </div>
                  <div>
                    <span>Memo</span>
                    <strong>{checkout.memo}</strong>
                  </div>
                </div>
                <div className="history-item">
                  <div>
                    <span>Treasury</span>
                    <strong>{shorten(state?.treasuryWallet)}</strong>
                  </div>
                  <div>
                    <span>Payment window</span>
                    <strong>{state?.paymentWindowSeconds ?? 900} sec</strong>
                  </div>
                </div>
              </div>

              <label className="field">
                <span>Transaction signature</span>
                <input
                  value={signature}
                  onChange={(event) => setSignature(event.target.value)}
                  placeholder="Paste the confirmed Solana signature"
                />
              </label>

              <button
                className="button button-primary"
                disabled={loading === "verify" || !signature.trim()}
                onClick={() => void verifyPayment()}
              >
                {loading === "verify" ? "Verifying..." : "Verify payment"}
              </button>
            </div>
          ) : null}

          <div className="route-badges">
            <StatusBadge tone={checkout ? "accent" : "warning"}>
              {checkout ? "Request pending" : "No active request"}
            </StatusBadge>
            <StatusBadge tone={state?.deviceAvailable ? "success" : "danger"}>
              {state?.deviceAvailable ? "Device available" : "Device occupied"}
            </StatusBadge>
          </div>
        </section>

        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Queue</p>
                <h2>Current control and waiting list</h2>
              </div>
            </div>

            {state?.current ? (
              <div className="session-card">
                <div>
                  <span>Now controlling</span>
                  <strong>{shorten(state.current.contractAddress)}</strong>
                </div>
                <div>
                  <span>Tier</span>
                  <strong>{state.current.tier}</strong>
                </div>
                <div>
                  <span>Ends</span>
                  <strong>
                    {state.current.expiresAt
                      ? new Date(state.current.expiresAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "Pending"}
                  </strong>
                </div>
                <div>
                  <span>Payer</span>
                  <strong>{shorten(state.current.payerWallet)}</strong>
                </div>
              </div>
            ) : (
              <p className="empty-state">
                Nobody is controlling the public device right now.
              </p>
            )}

            {state?.queue.length ? (
              <div className="history-list">
                {state.queue.map((item, index) => (
                  <div key={item.id} className="history-item">
                    <div>
                      <span>#{index + 1}</span>
                      <strong>{shorten(item.contractAddress)}</strong>
                    </div>
                    <div>
                      <span>Tier</span>
                      <strong>{item.tier}</strong>
                    </div>
                    <div>
                      <span>Memo</span>
                      <strong>{item.memo}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                No verified requests are waiting in the queue.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Recent</p>
                <h2>Your latest requests</h2>
              </div>
            </div>

            {state?.recentRequests.length ? (
              <div className="history-list">
                {state.recentRequests.map((item) => (
                  <div key={item.id} className="history-item">
                    <div>
                      <span>{item.status}</span>
                      <strong>{shorten(item.contractAddress)}</strong>
                    </div>
                    <div>
                      <span>Tier</span>
                      <strong>{item.tier}</strong>
                    </div>
                    <div>
                      <span>Memo</span>
                      <strong>{item.memo}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                Your latest queue requests will show up here after you generate a memo.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
