import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { TianziTradeForm } from "@/components/tianzi/TianziTradeForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getMeshCommerceSummary } from "@/lib/server/mesh-commerce";
import {
  getCurrentLoadedIdentity,
  getTianziState,
} from "@/lib/server/tianezha-simulation";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TianziPage() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  const tianzi = await getTianziState(loadedIdentity?.profile.id);
  const meshCommerce = getMeshCommerceSummary();

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Tianzi</p>
          <h1>Prediction and futarchy markets for the two Tianezha worlds.</h1>
          <p className="route-summary">
            Tianzi borrows binary-market structure from Polymarket, but every question, share,
            fill, and resolution lives locally inside Tianezha. The final world score always stays
            exact: 0.42 governance share, 0.42 futarchy share, and 0.16 revenue share.
          </p>
          <div className="route-badges">
            <StatusBadge tone="success">Auto-resolution</StatusBadge>
            <StatusBadge tone="accent">Binary books</StatusBadge>
            <StatusBadge tone="accent">Compute forecasts</StatusBadge>
            <StatusBadge tone="warning">Simulation-only</StatusBadge>
          </div>
        </div>

        <aside className="home-hero-rail">
          <div className="rail-grid">
            <article className="rail-card">
              <p className="eyebrow">Current question</p>
              <strong>{tianzi.question.title}</strong>
              <span>Closes at {new Date(tianzi.question.closesAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Book</p>
              <strong>YES {(tianzi.book.yesPrice * 100).toFixed(1)}%</strong>
              <span>NO {(tianzi.book.noPrice * 100).toFixed(1)}% with a {tianzi.book.spreadBps} bps spread.</span>
            </article>
          </div>
        </aside>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Place position</p>
              <h2>Trade the current Tianzi question</h2>
            </div>
          </div>
          <TianziTradeForm questionId={tianzi.question.id} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Hybrid futarchy</p>
              <h2>Current world prices under the shared score formula</h2>
            </div>
          </div>
          <div className="mini-list">
            {tianzi.worldQuotes.map(({ priceUsd, world }) => (
              <article key={world.id} className="mini-item-card">
                <div>
                  <span>{world.questionPromptLabel}</span>
                  <strong>{formatUsd(priceUsd)}</strong>
                </div>
                <p className="route-summary compact">
                  {world.displayName}. FinalScore = 0.42 governance + 0.42 futarchy + 0.16 revenue.
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Your positions</p>
              <h2>Loaded profile activity</h2>
            </div>
          </div>
          <div className="mini-list">
            {tianzi.profilePositions.length ? (
              tianzi.profilePositions.map((position) => (
                <article key={position.id} className="mini-item-card">
                  <div>
                    <span>{position.selection}</span>
                    <strong>{position.shares.toFixed(2)} shares</strong>
                  </div>
                  <p className="route-summary compact">
                    Stake {position.stake.toFixed(2)} at entry {position.entryPrice.toFixed(2)}.
                  </p>
                </article>
              ))
            ) : (
              <article className="mini-item-card">
                <div>
                  <span>No positions yet</span>
                  <strong>Start with the live question</strong>
                </div>
                <p className="route-summary compact">Load a profile and place a Tianzi position to see it here.</p>
              </article>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent windows</p>
              <h2>Resolved and open questions</h2>
            </div>
          </div>
          <div className="mini-list">
            {tianzi.recentQuestions.map((question) => (
              <article key={question.id} className="mini-item-card">
                <div>
                  <span>{question.status}</span>
                  <strong>{question.title}</strong>
                </div>
                <p className="route-summary compact">
                  {question.resolution
                    ? `${question.resolution.result.toUpperCase()} at ${new Date(question.resolution.resolvedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                    : `Open until ${new Date(question.closesAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Compute forecast bands</p>
              <h2>Tianzi price questions for mesh compute</h2>
            </div>
          </div>
          <div className="mini-list">
            {meshCommerce.compute.forecastQuestions.map((question) => (
              <article key={question.id} className="mini-item-card">
                <div>
                  <span>{question.resourceClass}</span>
                  <strong>{question.prompt}</strong>
                </div>
                <p className="route-summary compact">
                  Threshold {formatUsd(question.thresholdPrice)} | {question.region} | {question.tier}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Reference prices</p>
              <h2>Spot + perp + forecast blend</h2>
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
                  {formatUsd(price.forecastPrice || 0)} | {price.liquidityMode}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </TianezhaScaffold>
  );
}
