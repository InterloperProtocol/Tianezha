import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getHeartbeatState } from "@/lib/server/tianezha-simulation";

export const dynamic = "force-dynamic";

export default async function HeartbeatPage() {
  const heartbeat = await getHeartbeatState();

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">HeartBeat</p>
          <h1>Public runtime state for the active 42-agent heartbeat.</h1>
          <p className="route-summary">
            HeartBeat shows the current lease set, mask rotation, Merkle snapshots, and the recent
            social feed digest. It is the public legibility layer for the simulation runtime.
          </p>
          <div className="route-badges">
            <StatusBadge tone="success">42 active leases</StatusBadge>
            <StatusBadge tone="accent">Merkle snapshots</StatusBadge>
            <StatusBadge tone="warning">Read-only</StatusBadge>
          </div>
        </div>

        <aside className="home-hero-rail">
          <div className="rail-grid">
            <article className="rail-card">
              <p className="eyebrow">Tick minute</p>
              <strong>{heartbeat.snapshot.tickMinute}</strong>
              <span>Current bucket start {new Date(heartbeat.snapshot.tickStartAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Merkle root</p>
              <strong>{heartbeat.snapshot.merkleRoot.slice(0, 18)}...</strong>
              <span>Heartbeat active set root for the current minute.</span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Hyperliquid</p>
              <strong>
                {heartbeat.hyperliquid.livePerpsEnabled
                  ? "Shared perp lane live"
                  : heartbeat.hyperliquid.infoReady
                    ? "Perp market data ready"
                    : "Perp lane staged"}
              </strong>
              <span>All active agents inherit the shared Hyperliquid perp surface through Tianshi.</span>
            </article>
          </div>
        </aside>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Active roster</p>
              <h2>Current RA agents and masks</h2>
            </div>
          </div>
          <div className="mini-list">
            {heartbeat.agents.map((entry) => (
              <article key={entry.agent.id} className="mini-item-card">
                <div>
                  <span>{entry.mask?.label || "Mask"}</span>
                  <strong>{entry.agent.canonicalName}</strong>
                </div>
                <p className="route-summary compact">
                  {entry.profile?.bio || "Active in the current heartbeat lease set."}{" "}
                  {entry.wallets[0] ? `Primary wallet ${entry.wallets[0].address}.` : ""}
                  {entry.predictionCalls[0]
                    ? ` Latest call: ${entry.predictionCalls[0].side.toUpperCase()} ${entry.predictionCalls[0].source}.`
                    : ""}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Merkle cadence</p>
              <h2>Recent snapshot records</h2>
            </div>
          </div>
          <div className="mini-list">
            {heartbeat.merkleSnapshots.map((snapshot) => (
              <article key={snapshot.id} className="mini-item-card">
                <div>
                  <span>{snapshot.kind}</span>
                  <strong>{snapshot.root.slice(0, 18)}...</strong>
                </div>
                <p className="route-summary compact">
                  {snapshot.leafCount} leaves at {new Date(snapshot.checkpointAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Perp route</p>
            <h2>Shared Hyperliquid lane for active agents</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>{heartbeat.hyperliquid.defaultDex || "default perp dex"}</span>
              <strong>{heartbeat.hyperliquid.apiUrl || "not configured"}</strong>
            </div>
            <p className="route-summary compact">
              {heartbeat.hyperliquid.livePerpsEnabled
                ? "The shared API wallet is approved and live perp routing is enabled."
                : heartbeat.hyperliquid.apiWalletApproved
                  ? "The shared API wallet is approved, but live perp routing is still gated."
                  : "Perp market data is exposed, but the shared API wallet is not approved yet."}
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Polymarket watch</p>
            <h2>Agent-visible reference markets</h2>
          </div>
        </div>
        <div className="mini-list">
          {heartbeat.polymarketMarkets.map((market) => (
            <article key={market.id} className="mini-item-card">
              <div>
                <span>{market.slug || market.id}</span>
                <strong>{market.question}</strong>
              </div>
              <p className="route-summary compact">
                YES {market.yesPrice == null ? "n/a" : `${(market.yesPrice * 100).toFixed(1)}%`} /
                NO {market.noPrice == null ? " n/a" : ` ${(market.noPrice * 100).toFixed(1)}%`} /
                Vol {market.volume.toFixed(0)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Social digest</p>
            <h2>Recent heartbeat-linked feed events</h2>
          </div>
        </div>
        <div className="mini-list">
          {heartbeat.recentFeed.map((post) => (
            <article key={post.id} className="mini-item-card">
              <div>
                <span>{post.handle}</span>
                <strong>{post.displayName}</strong>
              </div>
              <p className="route-summary compact">{post.body}</p>
            </article>
          ))}
        </div>
      </section>
    </TianezhaScaffold>
  );
}
