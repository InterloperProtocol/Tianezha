"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  EntitlementRecord,
  LaunchonomicsEvaluation,
  LaunchonomicsTier,
} from "@/lib/types";

type Props = {
  accessTokenSymbol: string;
  freeAccessUntil: string;
  launchAt: string;
  sectionId?: string;
  showIntro?: boolean;
};

type ClaimResponse = {
  ok?: boolean;
  reused?: boolean;
  entitlement?: EntitlementRecord | null;
  error?: string;
};

const tierLabels: Record<LaunchonomicsTier, string> = {
  none: "No qualifying tier",
  monthly: "Monthly subscription",
  yearly: "Yearly subscription",
  five_year: "5-year subscription",
  lifetime: "Lifetime subscription",
};

function formatDate(value?: string) {
  if (!value) return "Not earned";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function plusMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function plusHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60_000).toISOString();
}

export function LaunchonomicsSection({
  accessTokenSymbol,
  freeAccessUntil,
  launchAt,
  sectionId,
  showIntro = false,
}: Props) {
  const searchParams = useSearchParams();
  const queryWallet = searchParams.get("wallet")?.trim() || "";
  const autoLookupRef = useRef<string>("");

  const [wallet, setWallet] = useState(queryWallet);
  const [result, setResult] = useState<LaunchonomicsEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const freeUntilLabel = formatDate(freeAccessUntil);
  const launchAtLabel = launchAt ? formatDate(launchAt) : "Not configured";

  const fallbackWindows = useMemo(
    () =>
      launchAt
        ? {
            first10MinutesEndsAt: plusMinutes(launchAt, 10),
            firstHourEndsAt: plusHours(launchAt, 1),
            first12HoursEndsAt: plusHours(launchAt, 12),
            first24HoursEndsAt: plusHours(launchAt, 24),
          }
        : null,
    [launchAt],
  );

  const windows = result?.windows ?? fallbackWindows;
  const canClaim = Boolean(result && result.tier !== "none");

  const lookup = useCallback(async (targetWallet = wallet.trim()) => {
    if (!targetWallet) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/launchonomics?wallet=${encodeURIComponent(targetWallet)}`,
      );
      const payload = (await response.json()) as {
        error?: string;
        item?: LaunchonomicsEvaluation;
      };
      if (!response.ok || !payload.item) {
        throw new Error(payload.error || "Failed to load eligibility");
      }

      setWallet(targetWallet);
      setResult(payload.item);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load eligibility",
      );
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  async function claimSubscriptionCnft() {
    if (!result || result.tier === "none") return;

    setClaiming(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/entitlements/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: result.wallet }),
      });
      const payload = (await response.json()) as ClaimResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Couldn't send the subscription pass");
      }

      if (payload.reused) {
        if (payload.entitlement?.type === "burn") {
          setNotice("This wallet already has an active burn-based access record.");
        } else {
          setNotice("This wallet already has a subscription pass on record.");
        }
        return;
      }

      setNotice("Subscription pass sent to the eligible wallet.");
    } catch (claimError) {
      setError(
        claimError instanceof Error
          ? claimError.message
          : "Couldn't send the subscription pass",
      );
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    if (!queryWallet || autoLookupRef.current === queryWallet) {
      return;
    }

    autoLookupRef.current = queryWallet;
    setWallet(queryWallet);
    void lookup(queryWallet);
  }, [lookup, queryWallet]);

  return (
    <section id={sectionId}>
      {showIntro ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Wallet access</p>
              <h2>Check access right here on the homepage</h2>
            </div>
          </div>
          <p className="panel-lead">
            Paste a Solana wallet to review its LaunchONomics result for{" "}
            {accessTokenSymbol}. If it qualifies, you can send the subscription
            pass without leaving the homepage.
          </p>
          <div className="route-badges">
            <StatusBadge tone="warning">Fast lookup</StatusBadge>
            <StatusBadge tone="neutral">No wallet connect required</StatusBadge>
            <StatusBadge tone="accent">Claim from here</StatusBadge>
          </div>
        </section>
      ) : null}

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="dashboard-grid">
        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Wallet lookup</p>
                <h2>Check subscription access</h2>
              </div>
            </div>

            <label className="field">
              <span>Solana wallet</span>
              <input
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="Paste a wallet address"
              />
            </label>

            <div className="button-row">
              <button
                className="button button-primary"
                disabled={loading || !wallet.trim()}
                onClick={() => void lookup()}
              >
                {loading ? "Checking..." : "Check wallet"}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Access windows</p>
                <h2>Launch timeline</h2>
              </div>
            </div>

            <div className="history-list">
              <div className="history-item">
                <div>
                  <span>Open access ends</span>
                  <strong>{freeUntilLabel}</strong>
                </div>
                <div>
                  <span>Launch window starts</span>
                  <strong>{launchAt ? launchAtLabel : "Awaiting config"}</strong>
                </div>
              </div>
              <div className="history-item">
                <div>
                  <span>0-10 minutes</span>
                  <strong>5-year subscription</strong>
                </div>
                <div>
                  <span>Window end</span>
                  <strong>
                    {windows ? formatDate(windows.first10MinutesEndsAt) : "Not configured"}
                  </strong>
                </div>
              </div>
              <div className="history-item">
                <div>
                  <span>0-1 hour</span>
                  <strong>Yearly subscription</strong>
                </div>
                <div>
                  <span>Window end</span>
                  <strong>
                    {windows ? formatDate(windows.firstHourEndsAt) : "Not configured"}
                  </strong>
                </div>
              </div>
              <div className="history-item">
                <div>
                  <span>0-12 hours</span>
                  <strong>Monthly subscription</strong>
                </div>
                <div>
                  <span>Window end</span>
                  <strong>
                    {windows ? formatDate(windows.first12HoursEndsAt) : "Not configured"}
                  </strong>
                </div>
              </div>
              <div className="history-item">
                <div>
                  <span>Hold through 24h</span>
                  <strong>Lifetime + verified badge</strong>
                </div>
                <div>
                  <span>Hold deadline</span>
                  <strong>
                    {windows ? formatDate(windows.first24HoursEndsAt) : "Not configured"}
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Result</p>
                <h2>Wallet result</h2>
              </div>
            </div>

            {result ? (
              <>
                <div className="session-card">
                  <div>
                    <span>Tier</span>
                    <strong>{tierLabels[result.tier]}</strong>
                  </div>
                  <div>
                    <span>Badge</span>
                    <strong>{result.badge === "none" ? "None" : result.badge}</strong>
                  </div>
                  <div>
                    <span>First trade</span>
                    <strong>{formatDate(result.firstTradeAt)}</strong>
                  </div>
                  <div>
                    <span>24h hold</span>
                    <strong>{result.heldThrough24Hours ? "Yes" : "No"}</strong>
                  </div>
                </div>

                <p className="hero-summary">{result.summary}</p>

                <div className="history-list">
                  <div className="history-item">
                    <div>
                      <span>Qualifying trades</span>
                      <strong>{result.qualifyingTradeCount}</strong>
                    </div>
                    <div>
                      <span>Current balance</span>
                      <strong>
                        {result.currentBalance !== undefined
                          ? `${result.currentBalance} ${result.currentBalanceSymbol}`
                          : "Unknown"}
                      </strong>
                    </div>
                  </div>
                  <div className="history-item">
                    <div>
                      <span>Subscription ends</span>
                      <strong>
                        {result.subscriptionEndsAt
                          ? formatDate(result.subscriptionEndsAt)
                          : result.tier === "lifetime"
                            ? "Never"
                            : "No subscription"}
                      </strong>
                    </div>
                    <div>
                      <span>Launch-day trade</span>
                      <strong>{result.tradedWithin24Hours ? "Yes" : "No"}</strong>
                    </div>
                  </div>
                </div>

                <div className="button-row">
                  <button
                    className="button button-primary"
                    disabled={!canClaim || claiming}
                    onClick={() => void claimSubscriptionCnft()}
                  >
                    {claiming ? "Sending..." : "Send subscription pass"}
                  </button>
                </div>

                {!canClaim ? (
                  <p className="empty-state">
                    This wallet does not qualify for a subscription pass right now.
                  </p>
                ) : (
                  <p className="empty-state">
                    This wallet is ready. Send the subscription pass whenever you&apos;re ready.
                  </p>
                )}
                <div className="route-badges">
                  <StatusBadge tone={canClaim ? "success" : "warning"}>
                    {canClaim ? "Access ready" : "No active access"}
                  </StatusBadge>
                  <StatusBadge tone="neutral">
                    {result.badge === "none" ? "No badge" : `${result.badge} badge`}
                  </StatusBadge>
                </div>
              </>
            ) : (
              <p className="empty-state">
                Paste a wallet to see its LaunchONomics tier, launch timing, and
                access details.
              </p>
            )}
          </section>
        </div>
      </section>
    </section>
  );
}
