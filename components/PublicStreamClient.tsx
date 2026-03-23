"use client";

import { useEffect, useMemo, useState } from "react";

import { NewsPanel } from "@/components/NewsPanel";
import { PriceChart } from "@/components/PriceChart";
import { SimpleStreamEmbedPanel } from "@/components/SimpleStreamEmbedPanel";
import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChartSnapshot, PublicStreamPageState } from "@/lib/types";

type StreamPageResponse = PublicStreamPageState & {
  publicUrl: string;
};

function shorten(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function PublicStreamClient({
  slug,
  initialState,
}: {
  slug: string;
  initialState: StreamPageResponse;
}) {
  const [state, setState] = useState<StreamPageResponse>(initialState);
  const [chartSnapshot, setChartSnapshot] = useState<ChartSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const response = await fetch(`/api/goonstreams/${slug}`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as StreamPageResponse;
      if (!cancelled) {
        setState(payload);
      }
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [slug]);

  const focusContractAddress = useMemo(
    () =>
      state.activeSession?.contractAddress ||
      state.profile.defaultContractAddress,
    [state.activeSession?.contractAddress, state.profile.defaultContractAddress],
  );

  return (
    <div className="app-shell">
      <SiteNav />
      <RouteHeader
        eyebrow="BolClaw"
        title={`@${state.profile.slug}`}
        summary="Public BolClaw room view with chart, media, and live session status."
        badges={[
          state.activeSession ? "Live" : "Public page",
          "Read only",
          "Shared room",
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Status</p>
              <strong>{state.activeSession?.status || "Offline"}</strong>
              <span>Live room status.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Mode</p>
              <strong>{state.activeSession?.mode || "Idle"}</strong>
              <span>Current playback mode.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Device</p>
              <strong>
                {state.activeDeviceLabel ||
                  state.activeSession?.deviceType ||
                  "No device active"}
              </strong>
              <span>Active setup.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Default token</p>
              <strong>{shorten(state.profile.defaultContractAddress)}</strong>
              <span>Used when nothing is live.</span>
            </div>
          </div>
        }
      />

      <section className="dashboard-grid dashboard-grid-triple">
        <PriceChart
          contractAddress={focusContractAddress}
          onSnapshotChange={setChartSnapshot}
        />
        <NewsPanel
          title={`${chartSnapshot?.symbol ?? "Solana"} news`}
          defaultCategory="solana"
        />
        <SimpleStreamEmbedPanel
          title="Shared media"
          description="Shared media for this room."
          url={state.profile.mediaUrl}
        />
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live state</p>
              <h2>Live now</h2>
            </div>
          </div>

          <div className="session-card">
            <div>
              <span>Session</span>
              <strong>{state.activeSession?.status || "Offline"}</strong>
            </div>
            <div>
              <span>Contract</span>
              <strong>{shorten(focusContractAddress)}</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>{state.activeSession?.mode || "Idle"}</strong>
            </div>
            <div>
              <span>Device</span>
              <strong>
                {state.activeDeviceLabel ||
                  state.activeSession?.deviceType ||
                  "None"}
              </strong>
            </div>
          </div>

          <div className="route-badges">
            <StatusBadge tone={state.activeSession ? "success" : "warning"}>
              {state.activeSession ? "Live now" : "Offline"}
            </StatusBadge>
            <StatusBadge tone="accent">@{state.profile.slug}</StatusBadge>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent sessions</p>
              <h2>Recent activity</h2>
            </div>
          </div>

          {state.recentSessions.length ? (
            <div className="history-list scroll-feed">
              {state.recentSessions.map((session) => (
                <div key={session.id} className="history-item">
                  <div>
                    <span>{session.status}</span>
                    <strong>{shorten(session.contractAddress)}</strong>
                  </div>
                  <div>
                    <span>Mode</span>
                    <strong>{session.mode}</strong>
                  </div>
                  <div>
                    <span>Updated</span>
                    <strong>
                      {new Date(session.updatedAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No recent sessions have been shared yet.</p>
          )}
        </section>
      </section>
    </div>
  );
}
