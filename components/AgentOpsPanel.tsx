"use client";

import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { AgentOpsStatus } from "@/lib/types";

function shorten(value?: string) {
  if (!value) return "Waiting";
  if (value.length < 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

export function AgentOpsPanel() {
  const [status, setStatus] = useState<AgentOpsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/agent/status");
        const payload = (await response.json()) as AgentOpsStatus & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load agent status");
        }

        if (!cancelled) {
          setStatus(payload);
          setError(null);
          setLastUpdatedAt(Date.now());
        }
      } catch (loadError) {
        if (!cancelled) {
          setStatus(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load agent status",
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

  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Polling";

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agent Ops</p>
          <h2>Manual cNFT claims and buyback policy</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {status?.modelRuntime.configured ? "vertex ready" : "awaiting vars"}
        </div>
      </div>
      <p className="panel-lead">
        Polling <code>/api/agent/status</code> every 30 seconds so manual claim
        readiness, runtime wiring, and payment configuration stay visible.
      </p>

      <div className="route-badges">
        <StatusBadge tone="warning">Claim flow manual</StatusBadge>
        <StatusBadge tone={status?.invoiceVerificationReady ? "success" : "neutral"}>
          {status?.invoiceVerificationReady ? "Invoice armed" : "Invoice not armed"}
        </StatusBadge>
        <StatusBadge tone={status?.cnftTreeConfigured ? "success" : "danger"}>
          {status?.cnftTreeConfigured ? "cNFT tree ready" : "cNFT tree missing"}
        </StatusBadge>
        <StatusBadge tone="neutral" mono>
          Last update {lastUpdatedLabel}
        </StatusBadge>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="stats-grid">
        <div className="metric-card">
          <span>Claim flow</span>
          <strong>Manual</strong>
        </div>
        <div className="metric-card">
          <span>Eligibility gate</span>
          <strong>LaunchONomics</strong>
        </div>
        <div className="metric-card">
          <span>Creator fees for cNFT pool</span>
          <strong>{status?.creatorFeeCnftSharePct ?? 50}%</strong>
        </div>
        <div className="metric-card">
          <span>Creator fees to buybacks</span>
          <strong>{status?.creatorFeeBuybackSharePct ?? 50}%</strong>
        </div>
      </div>

      <div className="history-list">
        <div className="history-item">
          <div>
            <span>AI runtime</span>
            <strong>
              {status?.modelRuntime.configured ? "Vertex AI Gemini" : "Waiting"}
            </strong>
          </div>
          <div>
            <span>Model / region</span>
            <strong>
              {status
                ? `${status.modelRuntime.model} @ ${status.modelRuntime.location}`
                : "Waiting"}
            </strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Claim action</span>
            <strong>Check eligibility, then click receive</strong>
          </div>
          <div>
            <span>Reserve floor</span>
            <strong>{status?.reserveFloorSol ?? 1} SOL</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Invoice verification</span>
            <strong>
              {status?.invoiceVerificationReady ? "Pump Agent Payments" : "Not armed"}
            </strong>
          </div>
          <div>
            <span>Payment token</span>
            <strong>{shorten(status?.paymentCurrencyMint)}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>cNFT tree</span>
            <strong>{status?.cnftTreeConfigured ? "Configured" : "Missing"}</strong>
          </div>
          <div>
            <span>Project / authority</span>
            <strong>
              {status?.modelRuntime.projectId
                ? `${status.modelRuntime.projectId}${status.cnftAuthorityConfigured ? " + auth" : ""}`
                : "Waiting"}
            </strong>
          </div>
        </div>
      </div>

      <div className="reference-list">
        {status?.references.map((reference) => (
          <article key={reference.id} className="reference-item">
            <div>
              <strong>{reference.label}</strong>
              <p>{reference.note}</p>
            </div>
            <span className={reference.ready ? "status-chip ready" : "status-chip"}>
              {reference.ready ? "Ready" : "Missing"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
