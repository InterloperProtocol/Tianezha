import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAutonomousStatus } from "@/lib/server/autonomous-agent";
import { getTianshiDiagnosticsState } from "@/lib/server/tianezha-simulation";
import { formatCompact } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TianshiPage() {
  const [state, autonomous] = await Promise.all([
    getTianshiDiagnosticsState(),
    getAutonomousStatus(),
  ]);
  const riskPlane = autonomous.treasury.riskControlPlane;

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Tianshi</p>
          <h1>Read-only diagnostics for the orchestration layer.</h1>
          <p className="route-summary">
            Tianshi is no longer the public landing page. It now exists as the read-only
            diagnostics surface that points back to the repository, chart, runtime-loop, and
            heartbeat internals behind Tianezha, including the locked autonomous
            risk-control plane, holder-gated agent deployment seam, and alignment-goal registry.
          </p>
          <div className="route-badges">
            <StatusBadge tone="accent">Diagnostics only</StatusBadge>
            <StatusBadge tone="success">Runtime linked</StatusBadge>
            <StatusBadge tone="warning">Not the public home</StatusBadge>
          </div>
        </div>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Reference points</p>
              <h2>Trusted seams and ownership</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.diagnostics.map((entry) => (
              <article key={entry.label} className="mini-item-card">
                <div>
                  <span>{entry.label}</span>
                  <strong>{entry.value}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Hybrid futarchy</p>
              <h2>Governance, Tianzi, and Nezha blended into one score</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.hybridFutarchy.worlds.map((world) => (
              <article key={world.worldId} className="mini-item-card">
                <div>
                  <span>{world.displayName}</span>
                  <strong>{(world.finalScore * 100).toFixed(1)} composite</strong>
                </div>
                <p className="route-summary compact">
                  Gov {(world.governanceShare * 100).toFixed(1)} / Futarchy{" "}
                  {(world.futarchyShare * 100).toFixed(1)} / Revenue{" "}
                  {(world.revenueShare * 100).toFixed(1)}
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
              <p className="eyebrow">Recent roots</p>
              <h2>Merkle snapshot visibility</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.merkleSnapshots.map((snapshot) => (
              <article key={snapshot.id} className="mini-item-card">
                <div>
                  <span>{snapshot.kind}</span>
                  <strong>{snapshot.root.slice(0, 18)}...</strong>
                </div>
                <p className="route-summary compact">
                  {snapshot.leafCount} leaves at {snapshot.checkpointAt}.
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Percolator</p>
              <h2>Competitive pressure governor</h2>
            </div>
          </div>
          <div className="mini-list">
            <article className="mini-item-card">
              <div>
                <span>Effective multiplier</span>
                <strong>{(state.percolator.effectiveBenefitMultiplier * 100).toFixed(1)}%</strong>
              </div>
              <p className="route-summary compact">
                h = {state.percolator.h.toFixed(3)} against a requested competitive budget of{" "}
                {formatCompact(state.percolator.requestedCompetitiveBudget)}.
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Safe budget</span>
                <strong>{formatCompact(state.percolator.safeCompetitiveBudget)}</strong>
              </div>
              <p className="route-summary compact">
                Reward grants are scaled down once the simulation asks for more than the safe
                competitive envelope.
              </p>
            </article>
          </div>
        </section>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Agent abilities</p>
              <h2>Internal-only cognition and market adapters</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.agentAbilities.map((ability) => (
              <article key={ability.label} className="mini-item-card">
                <div>
                  <span>{ability.status}</span>
                  <strong>{ability.label}</strong>
                </div>
                <p className="route-summary compact">{ability.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Bot bindings</p>
              <h2>External identity attachment</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.botBindings.length ? (
              state.botBindings.map((binding) => (
                <article key={binding.id} className="mini-item-card">
                  <div>
                    <span>{binding.platform}</span>
                    <strong>{binding.displayName || binding.externalUserId}</strong>
                  </div>
                  <p className="route-summary compact">
                    {binding.identityProfileId} / {binding.status} / {binding.updatedAt}
                  </p>
                </article>
              ))
            ) : (
              <article className="mini-item-card">
                <div>
                  <span>No bindings yet</span>
                  <strong>Telegram and WeChat are ready for the shared identity model</strong>
                </div>
              </article>
            )}
          </div>
        </section>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Risk control plane</p>
              <h2>Locked trading guardrails and mutation lock</h2>
            </div>
          </div>
          <div className="mini-list">
            <article className="mini-item-card">
              <div>
                <span>Mutation lock</span>
                <strong>{riskPlane.mutationLock.locked ? "Locked" : "Unlocked"}</strong>
              </div>
              <p className="route-summary compact">{riskPlane.mutationLock.reason}</p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Position sizing</span>
                <strong>
                  {riskPlane.positionSizing.maxSinglePositionPct.toFixed(1)}% /{" "}
                  {riskPlane.positionSizing.maxPortfolioAllocationPct.toFixed(1)}%
                </strong>
              </div>
              <p className="route-summary compact">
                Max order {riskPlane.positionSizing.maxOrderNotionalUsdc.toFixed(2)} USDC,
                session order {riskPlane.positionSizing.maxSessionOrderNotionalUsdc.toFixed(
                  2,
                )} USDC.
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Slippage and liquidity</span>
                <strong>
                  {riskPlane.slippageLiquidityGuard.maxSlippageBps} bps /{" "}
                  {formatCompact(riskPlane.slippageLiquidityGuard.minLiquidityUsd)} USD
                </strong>
              </div>
              <p className="route-summary compact">
                Max price impact {riskPlane.slippageLiquidityGuard.maxPriceImpactPct.toFixed(
                  1,
                )}%. Live actions require evidence and replay artifacts.
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Report commerce</span>
                <strong>
                  {autonomous.reportCommerce.priceUsdc.toFixed(2)} USDC /{" "}
                  {autonomous.reportCommerce.purchaseWindowSeconds}s
                </strong>
              </div>
              <p className="route-summary compact">
                Public release mode {autonomous.reportCommerce.publicReleaseMode}. Trade delay{" "}
                {autonomous.reportCommerce.postPurchaseTradeDelaySeconds}s.
              </p>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Alignment registry</p>
              <h2>QAI, Gendelve, and Guildcoin as constrained theses</h2>
            </div>
          </div>
          <div className="mini-list">
            {autonomous.alignmentGoals.map((goal) => (
              <article key={goal.id} className="mini-item-card">
                <div>
                  <span>
                    {goal.title} / {goal.category} / {goal.status}
                  </span>
                  <strong>{goal.brief}</strong>
                </div>
                <p className="route-summary compact">
                  {goal.thesis} Token: {goal.tokenSymbol || "n/a"}.
                  X handle: {goal.xHandleStatus || "unresolved"}.
                  Evidence: {goal.evidenceRequired ? "required" : "not required"}.
                  Replay: {goal.replayRequired ? "required" : "not required"}.
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Holder deploy seam</p>
            <h2>AgFund marketplace and personal cockpit policy</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Marketplace</span>
              <strong>{autonomous.tooling.agfundMarketplaceUrl || "not configured"}</strong>
            </div>
            <p className="route-summary compact">
              Personal agent deployment is reserved for verified $CAMIUP holders on Solana or BNB.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Launch venues</span>
              <strong>{autonomous.treasury.tradeGuardrails.allowedTokenLaunchVenues.join(", ")}</strong>
            </div>
            <p className="route-summary compact">
              Prediction-market context stays on {autonomous.treasury.tradeGuardrails.predictionNetwork}.{" "}
              Perps may only route through{" "}
              {autonomous.treasury.tradeGuardrails.allowedPerpVenues.join(", ")}.
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Passive watchlist</p>
            <h2>Concrete X handles and token references from the brief</h2>
          </div>
        </div>
        <div className="mini-list">
          {autonomous.watchlistMetadata.map((entry) => (
            <article key={entry.id} className="mini-item-card">
              <div>
                <span>{entry.kind === "x_handle" ? "X handle" : "Token reference"}</span>
                <strong>{entry.reference}</strong>
              </div>
              <p className="route-summary compact">
                {entry.notes}
                {entry.url ? ` Link: ${entry.url}` : ""}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Reference markets</p>
            <h2>Polymarket feed visible to agents</h2>
          </div>
        </div>
        <div className="mini-list">
          {state.polymarketMarkets.map((market) => (
            <article key={market.id} className="mini-item-card">
              <div>
                <span>{market.slug || market.id}</span>
                <strong>{market.question}</strong>
              </div>
              <p className="route-summary compact">
                YES {market.yesPrice == null ? "n/a" : `${(market.yesPrice * 100).toFixed(1)}%`} /
                NO {market.noPrice == null ? " n/a" : ` ${(market.noPrice * 100).toFixed(1)}%`} /
                Liquidity {formatCompact(market.liquidity)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </TianezhaScaffold>
  );
}
