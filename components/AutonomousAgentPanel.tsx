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
    case "replication":
    case "self_mod":
      return "accent";
    case "policy":
    case "trade":
      return "warning";
    case "revenue":
      return "neutral";
    default:
      return "neutral";
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
          throw new Error(statusPayload.error || "Couldn't load autonomous status");
        }

        if (!feedResponse.ok || !Array.isArray(feedPayload)) {
          throw new Error("Couldn't load autonomous feed");
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
              : "Couldn't load autonomous status",
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

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Autonomous status</p>
          <h2>Heartbeat, treasury, and public decision trace</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {status?.modelRuntime.configured ? "Vertex only" : "Setup needed"}
        </div>
      </div>

      <p className="panel-lead">
        GoonClaw is autonomous and public users cannot steer it. This wall exposes
        the runtime heartbeat, reserve health, revenue routing, and the maximum
        public trace the system can safely publish, including the treasury guardrails
        that block arbitrary private-address transfers.
      </p>

      <div className="route-badges">
        <StatusBadge tone={status ? toneForPhase(status.runtimePhase) : "neutral"}>
          {status ? status.runtimePhase : "Loading"}
        </StatusBadge>
        <StatusBadge tone={status?.treasury.reserveHealthy ? "success" : "danger"}>
          {status?.treasury.reserveHealthy ? "Reserve healthy" : "Reserve breach"}
        </StatusBadge>
        <StatusBadge tone="accent">Vertex AI Gemini only</StatusBadge>
        <StatusBadge tone="warning">Owner-only controls</StatusBadge>
        <StatusBadge tone={status?.tooling.telegramBroadcastEnabled ? "success" : "neutral"}>
          {status?.tooling.telegramBroadcastEnabled
            ? "Telegram relay armed"
            : "Telegram relay idle"}
        </StatusBadge>
        <StatusBadge tone="neutral" mono>
          Last update {lastUpdatedLabel}
        </StatusBadge>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="stats-grid">
        <div className="metric-card">
          <span>Reserve floor</span>
          <strong>{status ? formatNumber(status.treasury.reserveFloorSol, 6) : "0.069420"} SOL</strong>
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
          <span>Open positions</span>
          <strong>{openPositions.length}</strong>
        </div>
      </div>

      <div className="history-list">
        <div className="history-item">
          <div>
            <span>Heartbeat</span>
            <strong>{formatTimestamp(status?.heartbeatAt)}</strong>
          </div>
          <div>
            <span>Wake reason</span>
            <strong>{status?.wakeReason || "Waiting"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Constitution hash</span>
            <strong>
              {status?.constitutionHash
                ? `${status.constitutionHash.slice(0, 10)}...${status.constitutionHash.slice(-10)}`
                : "Waiting"}
            </strong>
          </div>
          <div>
            <span>Trace mode</span>
            <strong>{status?.publicTraceMode || "maximum-available"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Tooling</span>
            <strong>
              {status?.tooling.solanaAgentKitConfigured ? "Solana Agent Kit ready" : "Solana Agent Kit waiting"}
            </strong>
          </div>
          <div>
            <span>MCP / skills</span>
            <strong>
              {status
                ? `${status.tooling.solanaMcpConfigured ? "MCP ready" : "MCP pending"} / ${status.tooling.loadedSkillCount} skills / Dexter x402 ${status.tooling.dexterX402Installed ? status.tooling.dexterX402Version || "installed" : "missing"}`
                : "Waiting"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Latest decision</span>
            <strong>{status?.latestPolicyDecision || "Waiting"}</strong>
          </div>
          <div>
            <span>Wallet</span>
            <strong>
              {status?.tooling.agentWalletAddress
                ? `${status.tooling.agentWalletAddress.slice(0, 4)}...${status.tooling.agentWalletAddress.slice(-4)}`
                : "Not configured"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Blocked actions</span>
            <strong>
              {status?.tooling.blockedActionNames.length
                ? status.tooling.blockedActionNames.join(" Â· ")
                : "No blocked actions listed"}
            </strong>
          </div>
          <div>
            <span>Allowed payout wallet</span>
            <strong>
              {status?.treasury.ownerWallet
                ? `${status.treasury.ownerWallet.slice(0, 4)}...${status.treasury.ownerWallet.slice(-4)}`
                : "Waiting"}
            </strong>
          </div>
        </div>
      </div>

      <div className="detail-list compact">
        <div className="detail">
          <dt>Revenue buckets</dt>
          <dd>
            {status
              ? `Owner ${formatNumber(status.revenueBuckets.ownerUsdc, 2)} USDC · Burn ${formatNumber(status.revenueBuckets.burnUsdc, 2)} USDC · Reserve ${formatNumber(status.revenueBuckets.reserveUsdc, 2)} USDC · Trading ${formatNumber(status.revenueBuckets.tradingUsdc, 2)} USDC · Session trade ${formatNumber(status.revenueBuckets.sessionTradeUsdc, 2)} USDC`
              : "Waiting"}
          </dd>
        </div>
        <div className="detail">
          <dt>Replication</dt>
          <dd>
            {status
              ? `${status.replication.enabled ? "Enabled" : "Paused"} · ${status.replication.childCount} child runtimes · ${status.replication.lastOutcome || "No replication event yet"}`
              : "Waiting"}
          </dd>
        </div>
        <div className="detail">
          <dt>Self-modification</dt>
          <dd>
            {status
              ? `${status.selfModification.enabled ? "Enabled" : "Disabled"} · ${status.selfModification.pendingProposal || status.selfModification.lastOutcome || "No self-mod proposal queued"}`
              : "Waiting"}
          </dd>
        </div>
        <div className="detail">
          <dt>Treasury guardrails</dt>
          <dd>
            {status
              ? `${status.treasury.transferGuardrails.arbitraryTransfersBlocked ? "Arbitrary transfers blocked" : "Unsafe"} Â· ${status.treasury.transferGuardrails.notes}`
              : "Waiting"}
          </dd>
        </div>
      </div>

      <div className="reference-list">
        {(status?.revenuePolicies ?? []).map((policy) => (
          <article key={policy.revenueClass} className="reference-item">
            <div>
              <strong>{policy.revenueClass}</strong>
              <p>{policy.notes}</p>
            </div>
            <span className="status-chip ready">
              {policy.ownerPct}/{policy.burnPct}/{policy.reservePct}/{policy.tradingPct}/{policy.sessionTradePct}
            </span>
          </article>
        ))}
      </div>

      <div className="panel-header">
        <div>
          <p className="eyebrow">Trace feed</p>
          <h2>Recent public heartbeat and decisions</h2>
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
                {event.rawTrace.length ? <span>{event.rawTrace.join(" · ")}</span> : null}
              </div>
              <div className="admin-history-actions">
                <span className={`status-chip ${toneForEvent(event.kind) === "success" ? "ready" : ""}`}>
                  {event.kind}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">The autonomous trace feed will appear after the next heartbeat.</p>
      )}
    </section>
  );
}
