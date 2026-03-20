"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PublicStreamSummary } from "@/lib/types";

type ActiveGoonStream = PublicStreamSummary & {
  publicUrl: string;
};

function shorten(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function GoonStreamsClient() {
  const [items, setItems] = useState<ActiveGoonStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/goonstreams");
        const payload = (await response.json()) as {
          items?: ActiveGoonStream[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load active streams");
        }

        if (!cancelled) {
          setItems(payload.items || []);
          setError(null);
          setLoading(false);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load active streams",
          );
          setLoading(false);
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="app-shell">
      <SiteNav />
      <RouteHeader
        eyebrow="GoonStreams"
        title="What is actually live right now."
        summary="Browse the public guest-session panels that are currently running a live device session. Open any stream to watch the chart, media, and session state in read-only mode."
        badges={[
          "Live only",
          "Public MyGoonClaw panels",
          "Auto-refreshing board",
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Active now</p>
              <strong>{items.length}</strong>
              <span>Only streams with an active or starting session show up here.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Refresh</p>
              <strong>Every 15 seconds</strong>
              <span>The board keeps checking for guests who just went live.</span>
            </div>
          </div>
        }
      />

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <section className="panel">
          <p className="empty-state">Checking which GoonStreams are live right now.</p>
        </section>
      ) : items.length ? (
        <section className="surface-grid">
          {items.map((item) => (
            <section key={item.profile.id} className="surface-card">
              <p className="eyebrow">@{item.profile.slug}</p>
              <h2>{item.activeSession.status === "active" ? "Live now" : "Starting up"}</h2>
              <p>
                Tracking {shorten(item.activeSession.contractAddress)} in{" "}
                {item.activeSession.mode} mode.
              </p>
              <div className="route-badges">
                <StatusBadge tone="success">{item.activeSession.status}</StatusBadge>
                <StatusBadge tone="neutral">
                  {item.activeDeviceLabel || item.activeSession.deviceType}
                </StatusBadge>
              </div>
              <dl className="detail-list compact">
                <div className="detail">
                  <dt>Default token</dt>
                  <dd>{shorten(item.profile.defaultContractAddress)}</dd>
                </div>
                <div className="detail">
                  <dt>Updated</dt>
                  <dd>
                    {new Date(item.activeSession.updatedAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </dd>
                </div>
              </dl>
              <div className="surface-card-footer">
                <StatusBadge tone="accent">Public panel</StatusBadge>
                <Link className="surface-card-link" href={item.publicUrl}>
                  Open stream
                </Link>
              </div>
            </section>
          ))}
        </section>
      ) : (
        <section className="panel">
          <p className="empty-state">
            No public guest-session streams are active right now.
          </p>
        </section>
      )}
    </div>
  );
}
