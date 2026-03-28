import { NezhaOrderForm } from "@/components/nezha/NezhaOrderForm";
import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getMeshCommerceSummary } from "@/lib/server/mesh-commerce";
import {
  getCurrentLoadedIdentity,
  getNezhaState,
} from "@/lib/server/tianezha-simulation";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NezhaPage() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  const nezha = await getNezhaState(loadedIdentity?.profile.id);
  const meshCommerce = getMeshCommerceSummary();

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Nezha</p>
          <h1>Simulated perps scoped to the two Tianezha worlds.</h1>
          <p className="route-summary">
            Nezha mirrors mark price, funding, leverage, and liquidation tiers locally. It never
            opens markets outside the two Tianezha worlds, never places on-chain trades, and keeps
            profile risk tied to the same BitClaw identity you already loaded.
          </p>
          <div className="route-badges">
            <StatusBadge tone="success">Market + limit + reduce-only</StatusBadge>
            <StatusBadge tone="accent">5x max leverage</StatusBadge>
            <StatusBadge tone="accent">Compute perps</StatusBadge>
            <StatusBadge tone="warning">Local liquidations only</StatusBadge>
          </div>
        </div>
      </section>

      <section className="simulation-card-grid">
        {nezha.markets.map((market) => (
          <article key={market.id} className="surface-card">
            <p className="eyebrow">{market.worldId}</p>
            <h2>{market.title}</h2>
            <p>Mark price blends the real chart reference and the simulated book mid.</p>
            <div className="detail-grid">
              <div className="detail">
                <dt>Reference</dt>
                <dd>{formatUsd(market.referencePrice)}</dd>
              </div>
              <div className="detail">
                <dt>Mark</dt>
                <dd>{formatUsd(market.markPrice)}</dd>
              </div>
              <div className="detail">
                <dt>Funding</dt>
                <dd>{(market.fundingRateHourly * 100).toFixed(2)}%/hr</dd>
              </div>
              <div className="detail">
                <dt>Open interest</dt>
                <dd>{formatUsd(market.openInterest)}</dd>
              </div>
            </div>
            <NezhaOrderForm marketId={market.id} />
          </article>
        ))}
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Open positions</p>
              <h2>Loaded profile exposure</h2>
            </div>
          </div>
          <div className="mini-list">
            {nezha.positions.length ? (
              nezha.positions.map((position) => (
                <article key={position.id} className="mini-item-card">
                  <div>
                    <span>{position.side}</span>
                    <strong>{position.quantity.toFixed(4)} at {formatUsd(position.entryPrice)}</strong>
                  </div>
                  <p className="route-summary compact">
                    Mark {formatUsd(position.markPrice)}. PnL {formatUsd(position.pnlUnrealized)}. Tier {position.liquidationTier}.
                  </p>
                </article>
              ))
            ) : (
              <article className="mini-item-card">
                <div>
                  <span>No positions yet</span>
                  <strong>Simulation book is clear</strong>
                </div>
                <p className="route-summary compact">Place a Nezha order to open your first simulated perp position.</p>
              </article>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Liquidations</p>
              <h2>Recent local liquidation events</h2>
            </div>
          </div>
          <div className="mini-list">
            {nezha.liquidations.length ? (
              nezha.liquidations.map((event) => (
                <article key={event.id} className="mini-item-card">
                  <div>
                    <span>{event.tier}</span>
                    <strong>{event.side} close {event.quantityClosed.toFixed(4)}</strong>
                  </div>
                  <p className="route-summary compact">
                    Closed at {formatUsd(event.markPrice)} inside the local simulation engine.
                  </p>
                </article>
              ))
            ) : (
              <article className="mini-item-card">
                <div>
                  <span>No liquidations</span>
                  <strong>Risk stack is healthy</strong>
                </div>
                <p className="route-summary compact">High-risk positions will appear here if the simulation trips liquidation tiers.</p>
              </article>
            )}
          </div>
        </section>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Compute perps</p>
              <h2>Offchain Nezha books for compute cost</h2>
            </div>
          </div>
          <div className="mini-list">
            {meshCommerce.compute.perpContracts.map((contract) => (
              <article key={contract.id} className="mini-item-card">
                <div>
                  <span>{contract.resourceClass}</span>
                  <strong>{formatUsd(contract.markPrice)}</strong>
                </div>
                <p className="route-summary compact">
                  Last {formatUsd(contract.lastPrice)} | {contract.region} | {contract.tier}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Floating price</p>
              <h2>Current compute reference lanes</h2>
            </div>
          </div>
          <div className="mini-list">
            {meshCommerce.compute.referencePrices.map((price) => (
              <article key={price.id} className="mini-item-card">
                <div>
                  <span>{price.resourceClass}</span>
                  <strong>{formatUsd(price.referencePrice)}</strong>
                </div>
                <p className="route-summary compact">
                  Spot {formatUsd(price.spotIndex)} | Perp {formatUsd(price.perpMark || 0)} | Forecast{" "}
                  {formatUsd(price.forecastPrice || 0)}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </TianezhaScaffold>
  );
}
