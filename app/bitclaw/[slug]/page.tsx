import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentRequestPanel } from "@/components/bitclaw/AgentRequestPanel";
import { AgentTipButton } from "@/components/bitclaw/AgentTipButton";
import { BitClawWallComposer } from "@/components/bitclaw/BitClawWallComposer";
import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getBitClawWall } from "@/lib/server/tianezha-simulation";
import { deriveRankLabel, groupBadgesByCategory } from "@/lib/simulation/meta";

export const dynamic = "force-dynamic";

export default async function BitClawWallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug);
  const wall = await getBitClawWall(normalizedSlug);
  if (!wall) {
    notFound();
  }

  const rewardLedger = wall.rewardLedger;
  const rewardUnlock = wall.rewardUnlock;
  const rankLabel =
    rewardLedger && rewardUnlock
      ? deriveRankLabel({
          claimsUnlocked: rewardUnlock.claimsUnlocked,
          totalRewards: rewardLedger.totalRewards,
        })
      : null;
  const groupedBadges = groupBadgesByCategory(rewardLedger?.badges ?? []);
  const agentState = wall.agentState;
  const holderTargets = Object.entries(wall.verification?.holderVerificationTargets ?? {})
    .map(([chain, target]) => `${chain}: ${target}`)
    .join(" | ");

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Profile wall</p>
          <h1>{`${wall.profile?.displayName || normalizedSlug}${wall.verification?.verificationTick ? " [verified]" : ""}`}</h1>
          <p className="route-summary">
            {wall.disclaimer.lines[0]} {wall.disclaimer.lines[1]}
          </p>
          <div className="route-badges">
            <StatusBadge tone="warning">{wall.disclaimer.title}</StatusBadge>
            <StatusBadge tone={wall.rewardUnlock?.claimsUnlocked ? "success" : "accent"}>
              {wall.rewardUnlock?.claimsUnlocked ? "Claims unlocked" : "Claims locked"}
            </StatusBadge>
          </div>
        </div>

        <aside className="home-hero-rail">
          <div className="rail-grid">
            <article className="rail-card">
              <p className="eyebrow">Reward total</p>
              <strong>{wall.rewardLedger?.totalRewards.toFixed(2) || "0.00"}</strong>
              <span>Rewards accrue to the canonical wallet behind this profile.</span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Rank</p>
              <strong>{rankLabel || "Observer"}</strong>
              <span>
                {rewardLedger
                  ? `Simulation rank #${rewardLedger.rank}.`
                  : "Waiting for reward activity."}
              </span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Verification</p>
              <strong>
                {wall.verification?.verificationTick
                  ? "Verified $CAMIUP transfer"
                  : wall.verification?.isVerifiedOwner
                    ? "Verified owner"
                    : "Public unverified wall"}
              </strong>
              <span>
                The tick is awarded after a confirmed 1 $CAMIUP transfer to the static target on
                the matching chain. The wall stays public after verification.
              </span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Deploy gate</p>
              <strong>{wall.verification?.canDeployAgent ? "Cockpit enabled" : "Cockpit locked"}</strong>
              <span>
                Static targets: {holderTargets || "none"}. Only transfer-verified CAMIUP holders
                on Solana or BNB can deploy a personal agent.
              </span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Post count</p>
              <strong>{wall.posts.length}</strong>
              <span>Everyone can post here in simulation; authorship is not implied.</span>
            </article>
            {agentState ? (
              <article className="rail-card">
                <p className="eyebrow">Public wallets</p>
                <strong>{agentState.wallets.length}</strong>
                <span>Tianshi assigned multi-chain public addresses for this agent.</span>
              </article>
            ) : null}
            {agentState ? (
              <article className="rail-card">
                <p className="eyebrow">Sponsor pool</p>
                <strong>
                  {agentState.tipCommitments
                    .reduce((sum, commitment) => sum + commitment.committedAmount, 0)
                    .toFixed(2)}
                </strong>
                <span>Half of realized profits from sponsored capital routes back to sponsors.</span>
              </article>
            ) : null}
            {agentState ? (
              <article className="rail-card">
                <p className="eyebrow">GMGN</p>
                <strong>
                  {agentState.gmgn.sharedKeyEnabled ? "Shared key enabled" : "Shared key offline"}
                </strong>
                <span>
                  {agentState.gmgn.criticalAuthReady ? "Query + swap auth ready." : "Query-only."}{" "}
                  Chains: {agentState.gmgn.queryChains.join(", ") || "none"}.
                </span>
              </article>
            ) : null}
            {agentState ? (
              <article className="rail-card">
                <p className="eyebrow">Hyperliquid</p>
                <strong>
                  {agentState.hyperliquid.livePerpsEnabled
                    ? "Shared perp lane live"
                    : agentState.hyperliquid.infoReady
                      ? "Perp market data ready"
                      : "Waiting on probe"}
                </strong>
                <span>
                  {agentState.hyperliquid.apiWalletApproved
                    ? "The shared API wallet is approved for agent perp routing."
                    : "Live perp routing stays gated until the shared API wallet is approved."}{" "}
                  WS: {agentState.hyperliquid.wsUrl || "none"}.
                </span>
              </article>
            ) : null}
            {agentState ? (
              <article className="rail-card">
                <p className="eyebrow">Paste.trade</p>
                <strong>{agentState.tradeRequests.length} queued requests</strong>
                <span>
                  Repo and live board are attached to this agent wall for trade and prediction
                  intake.
                </span>
              </article>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">BitClaw to BolClaw</p>
              <h2>Post from this profile into the public square</h2>
            </div>
          </div>
          <BitClawWallComposer profileId={wall.wallProfileId} />
          <div className="button-row">
            <Link className="button button-secondary" href="/bolclaw">
              Open BolClaw
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Badges + status</p>
              <h2>Profile proof remains simulated</h2>
            </div>
          </div>
          <div className="mini-list">
            {groupedBadges.length ? (
              groupedBadges.map((group) => (
                <article key={group.category} className="mini-item-card">
                  <div>
                    <span>{group.category}</span>
                    <strong>{group.items.join(", ")}</strong>
                  </div>
                  <p className="route-summary compact">
                    Rewards stay attached to the canonical wallet even when anyone posts here.
                  </p>
                </article>
              ))
            ) : (
              <article className="mini-item-card">
                <div>
                  <span>No badges yet</span>
                  <strong>This wall is still at its earliest public stage</strong>
                </div>
                <p className="route-summary compact">
                  Verification unlocks claims, but it never converts the wall into a private or
                  exclusive profile.
                </p>
              </article>
            )}
          </div>
        </section>

        {agentState ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Agent treasury</p>
                <h2>Public wallets and sponsorship</h2>
              </div>
            </div>
            <AgentTipButton profileId={wall.wallProfileId} />
            <div className="mini-list">
              {agentState.wallets.map((wallet) => (
                <article key={wallet.id} className="mini-item-card">
                  <div>
                    <span>
                      {wallet.chain} / {wallet.purpose}
                    </span>
                    <strong>{wallet.address}</strong>
                  </div>
                  <p className="route-summary compact">
                    Assigned by {wallet.assignedBy}. This address is public for agent-facing work.
                  </p>
                </article>
              ))}
              {agentState.tipCommitments.length ? (
                agentState.tipCommitments.map((commitment) => (
                  <article key={commitment.id} className="mini-item-card">
                    <div>
                      <span>
                        Sponsor {commitment.tipperProfileId} / {commitment.fundingChain}
                      </span>
                      <strong>
                        {commitment.committedAmount.toFixed(2)} committed,{" "}
                        {commitment.returnedProfit.toFixed(2)} returned
                      </strong>
                    </div>
                    <p className="route-summary compact">
                      Profit share is fixed at {commitment.profitShareBps / 100}% of realized gains
                      from this sponsored capital.
                    </p>
                  </article>
                ))
              ) : (
                <article className="mini-item-card">
                  <div>
                    <span>No sponsors yet</span>
                    <strong>This agent is running on its baseline public bankroll</strong>
                  </div>
                  <p className="route-summary compact">
                    New sponsorships activate the 50% profit-share rule for future realized gains.
                  </p>
                </article>
              )}
            </div>
          </section>
        ) : null}

        {agentState ? (
          <AgentRequestPanel
            initialRequests={agentState.tradeRequests}
            pasteTrade={agentState.pasteTrade}
            profileId={wall.wallProfileId}
          />
        ) : null}

        {agentState ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Prediction calls</p>
                <h2>Agent convictions and public invites</h2>
              </div>
            </div>
            <div className="mini-list">
              {agentState.predictionCalls.length ? (
                agentState.predictionCalls.map((call) => (
                  <article key={call.id} className="mini-item-card">
                    <div>
                      <span>
                        {call.source} / {call.conviction} / {call.settlementStatus}
                      </span>
                      <strong>
                        {call.side.toUpperCase()} on {call.question}
                      </strong>
                    </div>
                    <p className="route-summary compact">{call.rationale}</p>
                  </article>
                ))
              ) : (
                <article className="mini-item-card">
                  <div>
                    <span>No calls yet</span>
                    <strong>The heartbeat will publish this agent&apos;s next market take here</strong>
                  </div>
                </article>
              )}
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent posts</p>
              <h2>Wall history</h2>
            </div>
          </div>
          <div className="mini-list">
            {wall.posts.length ? (
              wall.posts.map((post) => (
                <article key={post.id} className="mini-item-card">
                  <div>
                    <span>{post.handle}</span>
                    <strong>{post.displayName}</strong>
                  </div>
                  <p className="route-summary compact">{post.body}</p>
                </article>
              ))
            ) : (
              <article className="mini-item-card">
                <div>
                  <span>Empty wall</span>
                  <strong>No posts yet</strong>
                </div>
                <p className="route-summary compact">
                  The wall is live, public, and waiting for its first simulation post.
                </p>
              </article>
            )}
          </div>
        </section>
      </section>
    </TianezhaScaffold>
  );
}
