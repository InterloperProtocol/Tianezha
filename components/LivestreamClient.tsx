"use client";

import { useEffect, useMemo, useState } from "react";

import { MediaEmbedPanel } from "@/components/MediaEmbedPanel";
import { NewsPanel } from "@/components/NewsPanel";
import { PriceChart } from "@/components/PriceChart";
import { PublicChatPanel } from "@/components/PublicChatPanel";
import { SiteNav } from "@/components/SiteNav";
import { TrenchesPanel } from "@/components/TrenchesPanel";
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
    contractAddress.trim() ||
    checkout?.contractAddress ||
    state?.current?.contractAddress ||
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
        throw new Error(payload.error || "Couldn't create payment details");
      }

      setCheckout(payload.item);
      setState(payload.state);
      setSignature("");
      setNotice(
        "Payment details are ready. Pay from your Solana wallet, then paste the confirmed signature below.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't create payment details",
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
        throw new Error(payload.error || "Couldn't confirm payment");
      }

      setState(payload.state);
      setCheckout(payload.item ?? checkout);
      setNotice(
        "Payment confirmed. If the room is open, your request will start right away.",
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
        eyebrow="GoonClaw"
        title="Run the public queue without the clutter."
        summary="Show what&apos;s live, collect paid requests, and keep the queue clear before anyone sends payment."
        badges={[
          "Clear live status",
          "Simple request flow",
          `Standard ${state?.standardPriceSol ?? "0.001"} SOL`,
          `Priority ${state?.priorityPriceSol ?? "0.01"} SOL`,
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Live room</p>
              <strong>{state?.deviceAvailable ? "Available" : "Busy or offline"}</strong>
              <span>Let viewers see right away whether the room is open.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Queue depth</p>
              <strong>{state?.queue.length ?? 0} waiting</strong>
              <span>Everyone can see how many requests are still ahead.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">On screen</p>
              <strong>{state?.current ? shorten(state.current.contractAddress) : "No active request"}</strong>
              <span>The current request always stays visible beside the queue.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Time to pay</p>
              <strong>{state?.paymentWindowSeconds ?? 900} sec</strong>
              <span>Viewers can see how long a request stays open for payment.</span>
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
          title="Live room video"
          description="Use a video or stream link to keep the live room preview visible while requests come in."
          defaultUrl={state?.embedUrl || ""}
          storageKey="goonclaw-livestream-media"
        />
      </section>

      <section className="dashboard-grid dashboard-grid-secondary">
        <TrenchesPanel />
        <PublicChatPanel />
      </section>

      <section className="dashboard-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Requests</p>
                <h2>Book time in the live queue</h2>
              </div>
            </div>

          <p className="hero-summary compact">
            Choose a contract, pick a lane, pay, and paste the confirmed
            signature to join the queue.
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
              {loading === "request" ? "Creating..." : "Generate payment details"}
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
                    <span>Payment memo</span>
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
                {loading === "verify" ? "Confirming..." : "Confirm payment"}
              </button>
            </div>
          ) : null}

          <div className="route-badges">
            <StatusBadge tone={checkout ? "accent" : "warning"}>
              {checkout ? "Request in progress" : "No active request"}
            </StatusBadge>
            <StatusBadge tone={state?.deviceAvailable ? "success" : "danger"}>
              {state?.deviceAvailable ? "Room available" : "Room occupied"}
            </StatusBadge>
          </div>
        </section>

        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Queue</p>
                <h2>Now live and up next</h2>
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
                The live room is open right now.
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
                Nothing is waiting in line right now.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Recent</p>
                <h2>Recent requests</h2>
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
                Your recent requests will show up here after you create one.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
