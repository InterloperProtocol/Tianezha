"use client";

import { useCallback, useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  AutonomousAgentStatus,
  AutonomousControlAction,
  AutonomousFeedEvent,
} from "@/lib/types";

type ControlRequestState = AutonomousControlAction | null;
type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "Waiting";
  }

  return new Date(value).toLocaleString("en-US", {
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
    default:
      return "accent";
  }
}

export function AutonomousRuntimeAdminPanel() {
  const [status, setStatus] = useState<AutonomousAgentStatus | null>(null);
  const [feed, setFeed] = useState<AutonomousFeedEvent[]>([]);
  const [loading, setLoading] = useState<ControlRequestState>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const [statusResponse, feedResponse] = await Promise.all([
      fetch("/api/internal-admin/autonomous/status", {
        credentials: "same-origin",
      }),
      fetch("/api/agent/feed?limit=12", {
        credentials: "same-origin",
      }),
    ]);

    if (statusResponse.status === 401) {
      setStatus(null);
      return;
    }

    const statusPayload = (await statusResponse.json()) as AutonomousAgentStatus & {
      error?: string;
    };
    const feedPayload = (await feedResponse.json()) as
      | AutonomousFeedEvent[]
      | { error?: string };

    if (!statusResponse.ok) {
      throw new Error(statusPayload.error || "Couldn't load autonomous runtime");
    }

    if (!feedResponse.ok || !Array.isArray(feedPayload)) {
      throw new Error("Couldn't load autonomous feed");
    }

    setStatus(statusPayload);
    setFeed(feedPayload);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadStatus();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Couldn't load autonomous runtime",
        );
      }
    })();
  }, [loadStatus]);

  async function runAction(action: AutonomousControlAction, note?: string) {
    setLoading(action);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/internal-admin/autonomous/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          note,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Couldn't run ${action}`);
      }

      await loadStatus();
      setNotice(`Autonomous action completed: ${action}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Couldn't run ${action}`,
      );
    } finally {
      setLoading(null);
    }
  }

  if (!status) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Autonomous runtime</p>
            <h2>Owner controls load after hidden-admin login</h2>
          </div>
        </div>
        {error ? <p className="error-banner">{error}</p> : null}
        <p className="empty-state">
          Unlock the hidden admin dashboard to pause, wake, settle, liquidate,
          or review self-mod and replication controls.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Autonomous runtime</p>
          <h2>Owner-only Tianshi controls</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          Hidden admin only
        </div>
      </div>

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <div className="route-badges">
        <StatusBadge tone={toneForPhase(status.runtimePhase)}>
          {status.runtimePhase}
        </StatusBadge>
        <StatusBadge tone={status.control.paused ? "warning" : "success"}>
          {status.control.paused ? "Paused" : "Running"}
        </StatusBadge>
        <StatusBadge tone={status.treasury.reserveHealthy ? "success" : "danger"}>
          {status.treasury.reserveHealthy ? "Reserve healthy" : "Reserve breach"}
        </StatusBadge>
      </div>

      <div className="history-list">
        <div className="history-item">
          <div>
            <span>Latest heartbeat</span>
            <strong>{formatTimestamp(status.heartbeatAt)}</strong>
          </div>
          <div>
            <span>Last action</span>
            <strong>{status.control.lastAction || "None yet"}</strong>
          </div>
        </div>
        <div className="history-item">
          <div>
            <span>Self-mod proposal</span>
            <strong>{status.selfModification.pendingProposal || "No proposal queued"}</strong>
          </div>
          <div>
            <span>Replication</span>
            <strong>
              {status.replication.enabled
                ? `${status.replication.childCount} child runtimes`
                : "Replication halted"}
            </strong>
          </div>
        </div>
      </div>

      <div className="button-row">
        <button
          className="button button-primary small"
          disabled={loading === "wake"}
          onClick={() => void runAction("wake", "Manual wake from hidden admin dashboard.")}
          type="button"
        >
          {loading === "wake" ? "Waking..." : "Wake now"}
        </button>
        <button
          className="button button-ghost small"
          disabled={loading === "pause"}
          onClick={() => void runAction("pause", "Paused from hidden admin dashboard.")}
          type="button"
        >
          {loading === "pause" ? "Pausing..." : "Pause"}
        </button>
        <button
          className="button button-secondary small"
          disabled={loading === "resume"}
          onClick={() => void runAction("resume", "Resumed from hidden admin dashboard.")}
          type="button"
        >
          {loading === "resume" ? "Resuming..." : "Resume"}
        </button>
      </div>

      <div className="button-row">
        <button
          className="button button-danger small"
          disabled={loading === "force_settle"}
          onClick={() => void runAction("force_settle", "Forced session settlement.")}
          type="button"
        >
          {loading === "force_settle" ? "Settling..." : "Force settle"}
        </button>
        <button
          className="button button-danger small"
          disabled={loading === "force_liquidate"}
          onClick={() => void runAction("force_liquidate", "Forced treasury liquidation.")}
          type="button"
        >
          {loading === "force_liquidate" ? "Liquidating..." : "Force liquidate"}
        </button>
      </div>

      <div className="button-row">
        <button
          className="button button-secondary small"
          disabled={loading === "approve_self_mod"}
          onClick={() => void runAction("approve_self_mod")}
          type="button"
        >
          {loading === "approve_self_mod" ? "Approving..." : "Approve self-mod"}
        </button>
        <button
          className="button button-ghost small"
          disabled={loading === "reject_self_mod"}
          onClick={() => void runAction("reject_self_mod")}
          type="button"
        >
          {loading === "reject_self_mod" ? "Rejecting..." : "Reject self-mod"}
        </button>
        <button
          className="button button-secondary small"
          disabled={loading === "trigger_replication"}
          onClick={() => void runAction("trigger_replication")}
          type="button"
        >
          {loading === "trigger_replication" ? "Replicating..." : "Trigger replication"}
        </button>
        <button
          className="button button-ghost small"
          disabled={loading === "halt_replication"}
          onClick={() => void runAction("halt_replication")}
          type="button"
        >
          {loading === "halt_replication" ? "Halting..." : "Halt replication"}
        </button>
      </div>

      {feed.length ? (
        <div className="history-list scroll-feed">
          {feed.map((event) => (
            <div key={event.id} className="history-item admin-history-item">
              <div>
                <span>{formatTimestamp(event.createdAt)}</span>
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
              </div>
              <div className="admin-history-actions">
                <span>{event.kind}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No autonomous runtime events have been published yet.</p>
      )}
    </section>
  );
}
