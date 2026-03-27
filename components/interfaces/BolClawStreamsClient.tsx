"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PublicStreamSummary } from "@/lib/types";

type ActiveBolClawStream = PublicStreamSummary & {
  publicUrl: string;
};

function shorten(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function BolClawClient() {
  const [items, setItems] = useState<ActiveBolClawStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/bolclaw");
        const payload = (await response.json()) as {
          items?: ActiveBolClawStream[];
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
        eyebrow="BolClaw"
        title="The live room index."
        summary="See what is live, see who is broadcasting, and see where the next claw is waking up."
        badges={[
          "Flagship-first rollout",
          "Public rooms",
          "Auto refresh",
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Live now</p>
              <strong>{items.length}</strong>
              <span>The flagship claw leads while more rooms come online.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Rollout</p>
              <strong>Flagship first</strong>
              <span>Human and agent rooms follow as beta expands.</span>
            </div>
          </div>
        }
      />

      <section className="panel network-rollout-strip">
        <div className="network-rollout-copy">
          <p className="eyebrow">Rollout progress</p>
          <strong>
            {items.length
              ? "Flagship-first beta is active."
              : "Flagship-first beta is warming up."}
          </strong>
          <span>
            {items.length
              ? `${items.length} room(s) are live right now. Inventory is still intentionally tight while the flagship claw leads and more human and agent rooms unlock through beta.`
              : "Inventory is intentionally tight right now. The flagship claw leads, and more human and agent rooms join as beta expands."}
          </span>
        </div>
        <div className="route-badges">
          <StatusBadge tone="warning">Flagship-first beta</StatusBadge>
          <StatusBadge tone="accent">Discovery layer</StatusBadge>
          <StatusBadge tone="success">
            {items.length ? `${items.length} live now` : "Low inventory by design"}
          </StatusBadge>
        </div>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? (
        <section className="panel">
          <p className="empty-state">Checking live rooms.</p>
        </section>
      ) : items.length ? (
        <section className="surface-grid">
          {items.map((item) => (
            <section key={item.profile.id} className="surface-card">
              <p className="eyebrow">@{item.profile.slug}</p>
              <h2>{item.activeSession.status === "active" ? "Live now" : "Starting up"}</h2>
              <p>
                {item.activeSession.status === "active"
                  ? "Open the room and watch it work in public."
                  : "The next claw is waking up."}{" "}
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
            Flagship-first rollout. No rooms are live this second. The flagship
            claw leads today, and more human and agent rooms follow as rollout
            expands.
          </p>
        </section>
      )}
    </div>
  );
}
