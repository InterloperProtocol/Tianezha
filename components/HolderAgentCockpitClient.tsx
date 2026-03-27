"use client";

import { type FormEvent, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  HolderDeployedAgent,
  LoadedIdentity,
  ProfileVerificationState,
} from "@/lib/simulation/types";

type HolderAgentCockpitState = {
  agfundMarketplaceUrl: string;
  deployments: HolderDeployedAgent[];
  eligibility: ProfileVerificationState | null;
  gmgn: {
    apiHost: string | null;
    criticalAuthReady: boolean;
    queryChains: string[];
    sharedKeyEnabled: boolean;
    toolFamilies: string[];
    tradingWallet: string | null;
  };
  hyperliquid: {
    apiUrl: string | null;
    apiWalletAddress: string | null;
    apiWalletApproved: boolean;
    defaultDex: string | null;
    enabled: boolean;
    infoReady: boolean;
    livePerpsEnabled: boolean;
    masterWalletAddress: string | null;
    wsUrl: string | null;
  };
  loadedIdentity: LoadedIdentity | null;
  reportCommerce: {
    enabled: boolean;
    knowledgeSalesEnabled: boolean;
    postPurchaseTradeDelaySeconds: number;
    priceUsdc: number;
    purchaseWindowSeconds: number;
  };
};

export function HolderAgentCockpitClient({
  initialState,
}: {
  initialState: HolderAgentCockpitState;
}) {
  const [cockpit, setCockpit] = useState(initialState);
  const [displayName, setDisplayName] = useState("");
  const [strategySummary, setStrategySummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const holderTargets = Object.entries(cockpit.eligibility?.holderVerificationTargets ?? {})
    .map(([chain, target]) => `${chain}: ${target}`)
    .join(" | ");

  async function handleDeploy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/agent/cockpit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          strategySummary,
        }),
      });
      const payload = (await response.json()) as {
        cockpit?: HolderAgentCockpitState;
        error?: string;
      };

      if (!response.ok || !payload.cockpit) {
        throw new Error(payload.error || "Could not deploy the holder agent.");
      }

      setCockpit(payload.cockpit);
      setDisplayName("");
      setStrategySummary("");
      setNotice("Holder agent deployed.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not deploy the holder agent.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Eligibility</p>
            <h2>Verification tick and deploy gate</h2>
          </div>
        </div>
        {!cockpit.loadedIdentity ? (
          <article className="mini-item-card">
            <div>
              <span>No loaded profile</span>
              <strong>Load a profile first</strong>
            </div>
            <p className="route-summary compact">
              The deploy gate only appears after Tianezha loads a profile and verifies a
              confirmed 1 $CAMIUP transfer to the static Solana or BNB target.
            </p>
          </article>
        ) : (
          <div className="mini-list">
            <article className="mini-item-card">
              <div>
                <span>Profile</span>
                <strong>{cockpit.loadedIdentity.profile.displayName}</strong>
              </div>
              <p className="route-summary compact">
                {cockpit.loadedIdentity.profile.ownerWallet} on{" "}
                {cockpit.loadedIdentity.profile.chain}
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Verification tick</span>
                <strong>{cockpit.eligibility?.verificationTick ? "Granted" : "Locked"}</strong>
              </div>
              <p className="route-summary compact">
                Verified owner: {cockpit.eligibility?.isVerifiedOwner ? "yes" : "no"}. Holder
                mode: confirmed 1 $CAMIUP transfer. Eligible holder worlds:{" "}
                {cockpit.eligibility?.verifiedHolderWorldIds.join(", ") || "none"}.
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Static verification targets</span>
                <strong>{holderTargets || "No targets configured"}</strong>
              </div>
              <p className="route-summary compact">
                The same chain-specific target stays fixed for the holder tick and later CAMIUP
                voting intents in the GenDelve layer.
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Deploy permission</span>
                <strong>{cockpit.eligibility?.canDeployAgent ? "Enabled" : "Not enabled"}</strong>
              </div>
              <p className="route-summary compact">
                Only profiles with a confirmed 1 $CAMIUP transfer to the static Solana or BNB
                target receive the tick and can deploy a personal agent cockpit.
              </p>
            </article>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Marketplace + reports</p>
            <h2>AgFund listing seam and x402 sale window</h2>
          </div>
        </div>
        <div className="route-badges">
          <StatusBadge tone="success">AgFund: {cockpit.agfundMarketplaceUrl}</StatusBadge>
          <StatusBadge tone={cockpit.gmgn.sharedKeyEnabled ? "accent" : "neutral"}>
            {cockpit.gmgn.sharedKeyEnabled ? "GMGN shared key" : "GMGN off"}
          </StatusBadge>
          <StatusBadge tone={cockpit.gmgn.criticalAuthReady ? "success" : "warning"}>
            {cockpit.gmgn.criticalAuthReady ? "GMGN swap auth ready" : "GMGN query-only"}
          </StatusBadge>
          <StatusBadge
            tone={
              cockpit.hyperliquid.livePerpsEnabled
                ? "success"
                : cockpit.hyperliquid.infoReady
                  ? "warning"
                  : "neutral"
            }
          >
            {cockpit.hyperliquid.livePerpsEnabled
              ? "Hyperliquid perps on"
              : cockpit.hyperliquid.infoReady
                ? "Hyperliquid data on"
                : "Hyperliquid off"}
          </StatusBadge>
          <StatusBadge tone={cockpit.reportCommerce.enabled ? "accent" : "neutral"}>
            Reports {cockpit.reportCommerce.enabled ? "enabled" : "disabled"}
          </StatusBadge>
          <StatusBadge tone="warning">
            {cockpit.reportCommerce.priceUsdc.toFixed(2)} USDC /{" "}
            {cockpit.reportCommerce.purchaseWindowSeconds}s
          </StatusBadge>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Trading scope</span>
              <strong>Pump.fun + Four.meme spot / Hyperliquid perps</strong>
            </div>
            <p className="route-summary compact">
              Prediction-market context stays on Polygon. Personal agents inherit the locked
              Tianshi control plane rather than bypassing it, and Hyperliquid perps only turn on
              when Tianshi&apos;s shared API wallet lane is approved.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>GMGN surface</span>
              <strong>{cockpit.gmgn.apiHost || "Not configured"}</strong>
            </div>
            <p className="route-summary compact">
              Tianshi and its holder agents share one GMGN key surface. Chains:{" "}
              {cockpit.gmgn.queryChains.join(", ") || "none"}. Tools:{" "}
              {cockpit.gmgn.toolFamilies.join(", ") || "none"}.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Hyperliquid perp lane</span>
              <strong>{cockpit.hyperliquid.apiUrl || "Not configured"}</strong>
            </div>
            <p className="route-summary compact">
              {cockpit.hyperliquid.livePerpsEnabled
                ? "Shared API wallet approved and live perp routing enabled."
                : cockpit.hyperliquid.apiWalletApproved
                  ? "Shared API wallet approved, but live perp routing is still gated."
                  : "Perp market data is staged, but the shared API wallet is not approved yet."}{" "}
              WS: {cockpit.hyperliquid.wsUrl || "none"}.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Knowledge sales</span>
              <strong>
                {cockpit.reportCommerce.knowledgeSalesEnabled ? "Enabled" : "Disabled"}
              </strong>
            </div>
            <p className="route-summary compact">
              Buy window {cockpit.reportCommerce.purchaseWindowSeconds}s. Trade delay{" "}
              {cockpit.reportCommerce.postPurchaseTradeDelaySeconds}s.
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Deploy</p>
            <h2>Create a holder agent</h2>
          </div>
        </div>
        <form className="trade-form" onSubmit={handleDeploy}>
          <label className="trade-form-field">
            <span>Agent name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Camiup Momentum Desk"
              disabled={loading || !cockpit.eligibility?.canDeployAgent}
            />
          </label>
          <label className="trade-form-field">
            <span>Strategy summary</span>
            <textarea
              value={strategySummary}
              onChange={(event) => setStrategySummary(event.target.value)}
              rows={4}
              placeholder="Short summary of how this agent should operate inside the locked control plane."
              disabled={loading || !cockpit.eligibility?.canDeployAgent}
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={loading || !cockpit.eligibility?.canDeployAgent}
          >
            {loading ? "Deploying..." : "Deploy holder agent"}
          </button>
        </form>
        {error ? <p className="error-banner">{error}</p> : null}
        {notice ? <p className="route-summary">{notice}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Deployed agents</p>
            <h2>Personal backend cockpit inventory</h2>
          </div>
        </div>
        <div className="mini-list">
          {cockpit.deployments.length ? (
            cockpit.deployments.map((deployment) => (
              <article key={deployment.id} className="mini-item-card">
                <div>
                  <span>
                    {deployment.status} / {deployment.tradeGoal}
                  </span>
                  <strong>{`${deployment.displayName}${deployment.verificationTick ? " [verified]" : ""}`}</strong>
                </div>
                <p className="route-summary compact">{deployment.strategySummary}</p>
                <p className="route-summary compact">
                  Venues: {deployment.tradingVenues.join(", ")}. Prediction network:{" "}
                  {deployment.predictionNetwork}. Perps: {deployment.perpVenue}. Report window:{" "}
                  {deployment.reportBuyWindowSeconds}s.
                </p>
                <p className="route-summary compact">
                  GMGN: {deployment.gmgnSharedKeyEnabled ? "shared key enabled" : "disabled"} /{" "}
                  {deployment.gmgnCriticalAuthReady ? "critical auth ready" : "query only"}.
                  Chains: {deployment.gmgnQueryChains.join(", ") || "none"}. Tools:{" "}
                  {deployment.gmgnToolFamilies.join(", ") || "none"}.
                </p>
                <p className="route-summary compact">
                  Hyperliquid: {deployment.hyperliquidInfoReady ? "market data ready" : "waiting"} /{" "}
                  {deployment.hyperliquidLivePerpsEnabled
                    ? "live perp lane enabled"
                    : deployment.hyperliquidApiWalletApproved
                      ? "api wallet approved"
                      : "api wallet not approved yet"}.
                </p>
                <div className="mini-list">
                  {deployment.wallets.map((wallet) => (
                    <article key={wallet.id} className="mini-item-card">
                      <div>
                        <span>
                          {wallet.chain} / {wallet.purpose}
                        </span>
                        <strong>{wallet.address}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <article className="mini-item-card">
              <div>
                <span>No holder agents yet</span>
                <strong>Deploy the first cockpit-backed agent from this profile</strong>
              </div>
            </article>
          )}
        </div>
      </section>
    </section>
  );
}
