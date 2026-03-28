"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { AutonomousAgentStatus, AutonomousFeedEvent } from "@/lib/types";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

function formatNumber(value: number, digits = 3) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Waiting";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Waiting";
  }

  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatNameList(names: string[], limit = 6) {
  if (!names.length) {
    return "Waiting";
  }

  const preview = names.slice(0, limit).join(" | ");
  return names.length > limit ? `${preview} | +${names.length - limit} more` : preview;
}

function toneForPhase(
  phase: AutonomousAgentStatus["runtimePhase"],
): BadgeTone {
  switch (phase) {
    case "awake":
      return "success";
    case "paused":
      return "warning";
    case "degraded":
      return "danger";
    case "settling":
    case "liquidating":
      return "accent";
    default:
      return "neutral";
  }
}

function toneForEvent(kind: AutonomousFeedEvent["kind"]): BadgeTone {
  switch (kind) {
    case "burn":
    case "heartbeat":
      return "success";
    case "control":
    case "market":
    case "replication":
    case "social":
    case "self_mod":
      return "accent";
    case "policy":
    case "trade":
      return "warning";
    case "docs":
    case "revenue":
    case "wallet":
      return "neutral";
    default:
      return "neutral";
  }
}

function labelForEvent(kind: AutonomousFeedEvent["kind"]) {
  switch (kind) {
    case "heartbeat":
      return "update";
    case "market":
      return "market";
    case "policy":
      return "note";
    case "control":
      return "status";
    case "social":
      return "broadcast";
    case "wallet":
      return "wallet";
    case "docs":
      return "docs";
    case "replication":
    case "self_mod":
      return "system";
    default:
      return kind;
  }
}

export function AutonomousAgentPanel() {
  const [status, setStatus] = useState<AutonomousAgentStatus | null>(null);
  const [feed, setFeed] = useState<AutonomousFeedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [statusResponse, feedResponse] = await Promise.all([
          fetch("/api/agent/status"),
          fetch("/api/agent/feed?limit=24"),
        ]);

        const statusPayload = (await statusResponse.json()) as AutonomousAgentStatus & {
          error?: string;
        };
        const feedPayload = (await feedResponse.json()) as
          | AutonomousFeedEvent[]
          | { error?: string };

        if (!statusResponse.ok) {
          throw new Error(statusPayload.error || "Couldn't load status");
        }

        if (!feedResponse.ok || !Array.isArray(feedPayload)) {
          throw new Error("Couldn't load updates");
        }

        if (!cancelled) {
          setStatus(statusPayload);
          setFeed(feedPayload);
          setError(null);
          setLastUpdatedAt(Date.now());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Couldn't load status",
          );
        }
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return "Polling";
    }

    return new Date(lastUpdatedAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastUpdatedAt]);

  const openPositions = status?.positions.filter((item) => item.status === "open") ?? [];
  const topTape = status?.marketIntel.topTape.slice(0, 4) ?? [];
  const configuredMcpNames = status?.tooling.configuredMcpServerNames ?? [];
  const vendoredSkillNames = (status?.tooling.vendoredSkillNames ?? []).filter(
    (name) =>
      name !== "dexter-agent" &&
      name !== "godmode-agent" &&
      name !== "polymarket-agent",
  );
  const codexSkillNames = status?.tooling.codexSkillNames ?? [];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Live status</p>
          <h2>Runtime health and public activity</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {status?.modelRuntime.configured ? "Live" : "Checking"}
        </div>
      </div>

      <p className="panel-lead">
        This page shows live runtime health, reserve posture, open trades, and
        recent public updates so the network can be legible in public. It is
        view-only.
      </p>

      <div className="route-badges">
        <StatusBadge tone={status ? toneForPhase(status.runtimePhase) : "neutral"}>
          {status ? status.runtimePhase : "Loading"}
        </StatusBadge>
        <StatusBadge tone={status?.treasury.reserveHealthy ? "success" : "danger"}>
          {status?.treasury.reserveHealthy ? "Reserve healthy" : "Reserve low"}
        </StatusBadge>
        <StatusBadge
          tone={
            status?.circuitBreakerState?.status === "open"
              ? "danger"
              : status?.circuitBreakerState?.status === "half_open"
                ? "warning"
                : "success"
          }
        >
          {status?.circuitBreakerState?.status === "open"
            ? "Breaker open"
            : status?.circuitBreakerState?.status === "half_open"
              ? "Breaker probing"
              : "Breaker closed"}
        </StatusBadge>
        <StatusBadge tone={status?.tooling.gmgnStandardAuthReady ? "accent" : "neutral"}>
          {status?.tooling.gmgnStandardAuthReady ? "GMGN query on" : "GMGN off"}
        </StatusBadge>
        <StatusBadge
          tone={
            status?.tooling.gmgnCriticalAuthReady
              ? "success"
              : status?.tooling.gmgnStandardAuthReady
                ? "warning"
                : "neutral"
          }
        >
          {status?.tooling.gmgnCriticalAuthReady
            ? "GMGN swap on"
            : status?.tooling.gmgnStandardAuthReady
              ? "GMGN query-only"
              : "GMGN idle"}
        </StatusBadge>
        <StatusBadge
          tone={
            status?.tooling.hyperliquidLivePerpsEnabled
              ? "success"
              : status?.tooling.hyperliquidInfoReady
                ? "warning"
                : "neutral"
          }
        >
          {status?.tooling.hyperliquidLivePerpsEnabled
            ? "HL perps on"
            : status?.tooling.hyperliquidInfoReady
              ? "HL data on"
              : "HL off"}
        </StatusBadge>
        <StatusBadge
          tone={
            status?.tooling.conwayCodexMcpConfigured
              ? status.tooling.conwayApiKeyConfigured
                ? "accent"
                : "warning"
              : "neutral"
          }
        >
          {status?.tooling.conwayCodexMcpConfigured
            ? status.tooling.conwayApiKeyConfigured
              ? "Conway fallback"
              : "Conway fallback cfg"
            : "Conway off"}
        </StatusBadge>
        <StatusBadge tone={status?.tooling.telegramBroadcastEnabled ? "success" : "neutral"}>
          {status?.tooling.telegramBroadcastEnabled ? "Telegram on" : "Telegram off"}
        </StatusBadge>
        <StatusBadge tone={status?.tooling.wechatBroadcastEnabled ? "success" : "neutral"}>
          {status?.tooling.wechatBroadcastEnabled ? "WeChat on" : "WeChat off"}
        </StatusBadge>
        <StatusBadge
          tone={
            status?.tooling.tavilyMcpConfigured
              ? status.tooling.tavilyApiKeyConfigured
                ? "accent"
                : "warning"
              : "neutral"
          }
        >
          {status?.tooling.tavilyMcpConfigured
            ? status.tooling.tavilyApiKeyConfigured
              ? "Tavily ready"
              : "Tavily cfg"
            : "Tavily off"}
        </StatusBadge>
        <StatusBadge tone={status?.tooling.context7McpConfigured ? "accent" : "neutral"}>
          {status?.tooling.context7McpConfigured ? "Context7 set" : "Context7 off"}
        </StatusBadge>
        <StatusBadge tone="neutral" mono>
          Last update {lastUpdatedLabel}
        </StatusBadge>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="stats-grid">
        <div className="metric-card">
          <span>Reserve floor</span>
          <strong>{status ? formatNumber(status.treasury.reserveFloorSol, 6) : "0.694200"} SOL</strong>
        </div>
        <div className="metric-card">
          <span>Current reserve</span>
          <strong>{status ? formatNumber(status.treasury.reserveSol, 6) : "0.000000"} SOL</strong>
        </div>
        <div className="metric-card">
          <span>Total processed</span>
          <strong>{status ? formatNumber(status.revenueBuckets.totalProcessedUsdc, 2) : "0.00"} USDC</strong>
        </div>
        <div className="metric-card">
          <span>Open trades</span>
          <strong>{openPositions.length}</strong>
        </div>
      </div>

      <div className="history-list">
        <div className="history-item">
          <div>
            <span>Last update</span>
            <strong>{formatTimestamp(status?.heartbeatAt)}</strong>
          </div>
          <div>
            <span>Current state</span>
            <strong>{status?.runtimePhase || "Waiting"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Latest runtime note</span>
            <strong>{status?.latestPolicyDecision || "Waiting"}</strong>
          </div>
          <div>
            <span>Public trace mode</span>
            <strong>{status?.publicTraceMode || "Waiting"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Agent wallet</span>
            <strong>
              {status?.tooling.agentWalletAddress
                ? `${status.tooling.agentWalletAddress.slice(0, 4)}...${status.tooling.agentWalletAddress.slice(-4)}`
                : "Not configured"}
            </strong>
          </div>
          <div>
            <span>Revenue wallet</span>
            <strong>
              {status?.treasury.treasuryWallet
                ? `${status.treasury.treasuryWallet.slice(0, 4)}...${status.treasury.treasuryWallet.slice(-4)}`
                : "Waiting"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Broadcast route</span>
            <strong>
              {status?.tooling.telegramBroadcastEnabled || status?.tooling.wechatBroadcastEnabled
                ? [
                    status?.tooling.telegramBroadcastEnabled ? "Telegram" : null,
                    status?.tooling.wechatBroadcastEnabled ? "WeChat" : null,
                  ]
                    .filter(Boolean)
                    .join(" + ")
                : "Feed paused"}
            </strong>
          </div>
          <div>
            <span>Trading route</span>
            <strong>
              {status?.tooling.gmgnStandardAuthReady
                ? status.tooling.gmgnCriticalAuthReady
                  ? "GMGN quote + swap ready"
                  : "GMGN quote ready / swap gated"
                : "Not set"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Report window</span>
            <strong>
              {status
                ? `${status.reportCommerce.priceUsdc.toFixed(2)} USDC / ${status.reportCommerce.purchaseWindowSeconds}s`
                : "Waiting"}
            </strong>
          </div>
          <div>
            <span>Marketplace seam</span>
            <strong>{status?.tooling.agfundEnabled ? "AgFund ready" : "AgFund off"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Execution route</span>
            <strong>
              {status?.tooling.conwayCodexMcpConfigured
                ? status.tooling.conwayApiKeyConfigured
                  ? "Google Cloud primary / Conway fallback ready"
                  : "Google Cloud primary / Conway fallback waiting for API key"
                : "Google Cloud primary"}
            </strong>
          </div>
          <div>
            <span>GMGN wallet</span>
            <strong>
              {status?.tooling.gmgnTradingWallet
                ? `${status.tooling.gmgnTradingWallet.slice(0, 4)}...${status.tooling.gmgnTradingWallet.slice(-4)}`
                : "Waiting"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>GMGN API host</span>
            <strong>{status?.tooling.gmgnApiHost || "Waiting"}</strong>
          </div>
          <div>
            <span>GMGN surface</span>
            <strong>
              {status
                ? `${formatNameList(status.tooling.gmgnQueryChains, 4)} | ${formatNameList(
                    status.tooling.gmgnToolFamilies,
                    6,
                  )}`
                : "Waiting"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Hyperliquid API</span>
            <strong>{status?.tooling.hyperliquidApiUrl || "Waiting"}</strong>
          </div>
          <div>
            <span>Hyperliquid lane</span>
            <strong>
              {status?.tooling.hyperliquidLivePerpsEnabled
                ? "Shared perp lane live"
                : status?.tooling.hyperliquidApiWalletApproved
                  ? "API wallet approved / live gated"
                  : status?.tooling.hyperliquidInfoReady
                    ? "Market data ready / API wallet pending"
                    : "Waiting"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Hyperliquid wallet</span>
            <strong>
              {status?.tooling.hyperliquidApiWallet
                ? `${status.tooling.hyperliquidApiWallet.slice(0, 6)}...${status.tooling.hyperliquidApiWallet.slice(-4)}`
                : "Waiting"}
            </strong>
          </div>
          <div>
            <span>Hyperliquid websocket</span>
            <strong>{status?.tooling.hyperliquidWsUrl || "Waiting"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Conway fallback hosts</span>
            <strong>
              {status
                ? status.treasury.transferGuardrails.conwayAllowedHosts.join(" | ")
                : "Waiting"}
            </strong>
          </div>
          <div>
            <span>WeChat relay</span>
            <strong>
              {status?.tooling.wechatWebhookConfigured ? "Webhook ready" : "Not configured"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Safety</span>
            <strong>
              {status?.treasury.transferGuardrails.arbitraryTransfersBlocked
                ? "Protected"
                : "Open"}
            </strong>
          </div>
          <div>
            <span>Telegram chat</span>
            <strong>{status?.tooling.telegramChatConfigured ? "Bound" : "Waiting"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Configured MCPs</span>
            <strong>{formatNameList(configuredMcpNames, 8)}</strong>
          </div>
          <div>
            <span>Vendored skills</span>
            <strong>
              {vendoredSkillNames.length
                ? `${vendoredSkillNames.length} loaded`
                : "No vendored skills"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Vendored skill pack</span>
            <strong>{formatNameList(vendoredSkillNames)}</strong>
          </div>
          <div>
            <span>Local Codex skills</span>
            <strong>{formatNameList(codexSkillNames)}</strong>
          </div>
        </div>
      </div>

      <div className="detail-list compact">
        <div className="detail">
          <dt>Funds split</dt>
          <dd>
            {status
              ? `Owner ${formatNumber(status.revenueBuckets.ownerUsdc, 2)} USDC | Burn ${formatNumber(status.revenueBuckets.burnUsdc, 2)} USDC | Reserve ${formatNumber(status.revenueBuckets.reserveUsdc, 2)} USDC | Trading ${formatNumber(status.revenueBuckets.tradingUsdc, 2)} USDC`
              : "Waiting"}
          </dd>
        </div>
        <div className="detail">
          <dt>Open trades</dt>
          <dd>
            {status
              ? openPositions.length
                ? openPositions
                    .map((position) => `${position.symbol} ${position.venue}`)
                    .join(" | ")
                : "No open trades"
              : "Waiting"}
          </dd>
        </div>
      </div>

      <div className="panel-header">
        <div>
          <p className="eyebrow">Mesh Commerce</p>
          <h2>Native compute, vendor, and payment rails</h2>
        </div>
      </div>

      <div className="route-badges">
        <StatusBadge tone={status?.meshCommerce.compute.walletConnectRequired ? "danger" : "success"}>
          {status?.meshCommerce.compute.walletConnectRequired
            ? "Wallet connect required"
            : "Wallet-free baseline"}
        </StatusBadge>
        <StatusBadge tone="accent">
          {status?.meshCommerce.adapters.gistbookEnabled ? "Gistbook on" : "Gistbook off"}
        </StatusBadge>
        <StatusBadge
          tone={status?.meshCommerce.adapters.cancerhawkEnabled ? "warning" : "neutral"}
        >
          {status?.meshCommerce.adapters.cancerhawkEnabled
            ? "CancerHawk adapter"
            : "CancerHawk off"}
        </StatusBadge>
        <StatusBadge
          tone={status?.meshCommerce.adapters.cancerPredictionEnabled ? "warning" : "neutral"}
        >
          {status?.meshCommerce.adapters.cancerPredictionEnabled
            ? "Cancer prediction sim"
            : "Cancer prediction off"}
        </StatusBadge>
      </div>

      <div className="history-list">
        <div className="history-item">
          <div>
            <span>Mesh doctrine</span>
            <strong>{status?.meshCommerce.sentence || "Waiting"}</strong>
          </div>
          <div>
            <span>Community bootstrap</span>
            <strong>
              {status?.meshCommerce.community.bootstrapMintAddresses.join(" | ") || "Waiting"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Open compute offers</span>
            <strong>{status?.meshCommerce.compute.openOffers ?? 0}</strong>
          </div>
          <div>
            <span>Completed jobs</span>
            <strong>{status?.meshCommerce.compute.completedAssignments ?? 0}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Proof-of-compute lane</span>
            <strong>
              {status
                ? formatNumber(
                    status.meshCommerce.compute.rewardSummary.proof_of_compute || 0,
                    2,
                  )
                : "0.00"}
            </strong>
          </div>
          <div>
            <span>Domain offers</span>
            <strong>{status?.meshCommerce.vendors.domainOffers.length ?? 0}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Gistbook atlas</span>
            <strong>Vectorless RAG, session terrain, and browser resume</strong>
          </div>
          <div className="button-row">
            <a className="button button-secondary small" href="/gistbook">
              Open Gistbook
            </a>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Payment adapters</span>
            <strong>
              {status?.meshCommerce.paymentAdapters.length
                ? status.meshCommerce.paymentAdapters
                    .map((adapter) =>
                      adapter.enabled ? adapter.label : `${adapter.label} (off)`,
                    )
                    .join(" | ")
                : "Waiting"}
            </strong>
          </div>
          <div>
            <span>RA market actors</span>
            <strong>{status?.meshCommerce.subagents.raActorIds.length ?? 0}</strong>
          </div>
        </div>
      </div>

      {status?.meshCommerce.compute.referencePrices.length ? (
        <div className="detail-list compact">
          {status.meshCommerce.compute.referencePrices.map((price) => (
            <div key={price.id} className="detail">
              <dt>
                {price.resourceClass} | {price.region} | {price.tier}
              </dt>
              <dd>
                Ref {formatNumber(price.referencePrice, 4)} | Spot{" "}
                {formatNumber(price.spotIndex, 4)} | Perp{" "}
                {formatNumber(price.perpMark || 0, 4)} | Forecast{" "}
                {formatNumber(price.forecastPrice || 0, 4)} | {price.liquidityMode}
              </dd>
            </div>
          ))}
        </div>
      ) : null}

      <div className="panel-header">
        <div>
          <p className="eyebrow">Market Heartbeat</p>
          <h2>Live tape and runtime candidate</h2>
        </div>
      </div>

      <div className="history-list">
        <div className="history-item">
          <div>
            <span>Heartbeat summary</span>
            <strong>{status?.marketIntel.summary || "Waiting"}</strong>
          </div>
          <div>
            <span>Next trade candidate</span>
            <strong>
              {status?.marketIntel.nextTradeCandidateSymbol
                ? `$${status.marketIntel.nextTradeCandidateSymbol}`
                : "No candidate"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Tracked wallets</span>
            <strong>{status?.marketIntel.trackedWallets.length ?? 0}</strong>
          </div>
          <div>
            <span>LLM docs cached</span>
            <strong>{status?.marketIntel.docs.length ?? 0}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Trade cards</span>
            <strong>{status?.marketIntel.tradeCards.length ?? 0}</strong>
          </div>
          <div>
            <span>Last trade card post</span>
            <strong>{formatTimestamp(status?.marketIntel.lastPostedAt)}</strong>
          </div>
        </div>
      </div>

      {topTape.length ? (
        <div className="detail-list compact">
          {topTape.map((item) => (
            <div key={item.id} className="detail">
              <dt>{item.label}</dt>
              <dd>{item.detail}</dd>
            </div>
          ))}
        </div>
      ) : null}

      <div className="panel-header">
        <div>
          <p className="eyebrow">Feed</p>
          <h2>Recent updates</h2>
        </div>
      </div>

      {feed.length ? (
        <div className="history-list scroll-feed">
          {feed.map((event) => (
            <div key={event.id} className="history-item admin-history-item">
              <div>
                <span>{formatTimestamp(event.createdAt)}</span>
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
                {event.rawTrace.length ? <span>{event.rawTrace.join(" | ")}</span> : null}
              </div>
              <div className="admin-history-actions">
                <span className={`status-chip ${toneForEvent(event.kind) === "success" ? "ready" : ""}`}>
                  {labelForEvent(event.kind)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">Updates will appear here soon.</p>
      )}
    </section>
  );
}
