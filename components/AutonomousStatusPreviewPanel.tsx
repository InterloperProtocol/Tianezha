"use client";

import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { AutonomousAgentStatus } from "@/lib/types";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

function toneForPhase(
  phase: AutonomousAgentStatus["runtimePhase"] | null,
): BadgeTone {
  switch (phase) {
    case "awake":
      return "success";
    case "degraded":
      return "danger";
    case "paused":
      return "warning";
    case "settling":
    case "liquidating":
      return "accent";
    default:
      return "neutral";
  }
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "Waiting";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AutonomousStatusPreviewPanel({
  eyebrow = "Live status",
  title = "GoonClaw heartbeat",
  description = "Heartbeat only. No controls here.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
} = {}) {
  const [status, setStatus] = useState<AutonomousAgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/agent/status");
        const payload = (await response.json()) as AutonomousAgentStatus & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Couldn't load autonomous status");
        }

        if (!cancelled) {
          setStatus(payload);
          setError(null);
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

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          Read-only
        </div>
      </div>

      <p className="panel-lead">{description}</p>

      <div className="route-badges">
        <StatusBadge tone={toneForPhase(status?.runtimePhase ?? null)}>
          {status?.runtimePhase || "Loading"}
        </StatusBadge>
        <StatusBadge tone={status?.treasury.reserveHealthy ? "success" : "danger"}>
          {status?.treasury.reserveHealthy ? "Reserve ok" : "Reserve low"}
        </StatusBadge>
        <StatusBadge tone="warning">No chat</StatusBadge>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="history-list">
        <div className="history-item">
          <div>
            <span>Last update</span>
            <strong>{formatTimestamp(status?.heartbeatAt)}</strong>
          </div>
          <div>
            <span>Latest note</span>
            <strong>{status?.latestPolicyDecision || "Waiting"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Open trades</span>
            <strong>{status?.positions.filter((item) => item.status === "open").length ?? 0}</strong>
          </div>
          <div>
            <span>Feed items</span>
            <strong>{status?.feedSize ?? 0}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
