import Link from "next/link";

import { AddressLoadForm } from "@/components/identity/AddressLoadForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getBitClawWall,
  getCurrentLoadedIdentity,
  getGenDelveState,
  getNezhaState,
  getTianziState,
} from "@/lib/server/tianezha-simulation";
import { deriveRankLabel, groupBadgesByCategory } from "@/lib/simulation/meta";
import { formatCompact, formatUsd } from "@/lib/utils";

export async function LoadedIdentityRail() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  const loadedBitClawHref = loadedIdentity
    ? `/bitclaw/${encodeURIComponent(loadedIdentity.profile.bitClawProfileId)}`
    : "/bitclaw";
  const [wall, tianzi, nezha, gendelve] = loadedIdentity
    ? await Promise.all([
        getBitClawWall(loadedIdentity.profile.bitClawProfileId),
        getTianziState(loadedIdentity.profile.id),
        getNezhaState(loadedIdentity.profile.id),
        getGenDelveState(loadedIdentity.profile.id),
      ])
    : [null, null, null, null];

  const rankLabel = loadedIdentity
    ? deriveRankLabel({
        claimsUnlocked: loadedIdentity.rewardUnlock.claimsUnlocked,
        totalRewards: loadedIdentity.rewardLedger.totalRewards,
      })
    : null;
  const groupedBadges = loadedIdentity
    ? groupBadgesByCategory(loadedIdentity.rewardLedger.badges)
    : [];
  const holderTargets = loadedIdentity
    ? Object.entries(loadedIdentity.verification.holderVerificationTargets)
        .map(([chain, target]) => `${chain}:${target}`)
        .join(" | ")
    : "";

  return (
    <div className="loaded-rail-shell">
      <section className="panel loaded-rail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">BitClaw profile</p>
            <h2>{loadedIdentity ? "Your world identity" : "Enter the world"}</h2>
          </div>
        </div>

        <AddressLoadForm
          ctaLabel={loadedIdentity ? "Rebuild profile" : "Enter world"}
          helperText="No signup. No wallet connect. Enter any address, ENS, SNS, or .bnb name."
        />

        {!loadedIdentity ? (
          <div className="loaded-rail-empty">
            <p className="route-summary">
              Load any address or registry name to pin your BitClaw profile here. This rail then
              follows you across Tianezha, BolClaw, Tianzi, Nezha, GenDelve, and HeartBeat.
            </p>
          </div>
        ) : (
          <div className="loaded-rail-sections">
            <section className="loaded-rail-section">
              <div className="loaded-rail-heading">
                <div>
                  <p className="eyebrow">Identity</p>
                  <h3>
                    {loadedIdentity.profile.displayName}
                    {loadedIdentity.verification.verificationTick ? " [verified]" : ""}
                  </h3>
                </div>
                <StatusBadge tone={loadedIdentity.rewardUnlock.claimsUnlocked ? "success" : "warning"}>
                  {loadedIdentity.rewardUnlock.claimsUnlocked ? "Verified owner" : "Unverified wall"}
                </StatusBadge>
              </div>
              <div className="loaded-identity-card">
                <div>
                  <span>Resolved identity</span>
                  <strong>{loadedIdentity.profile.publicLabel}</strong>
                </div>
                <div>
                  <span>Wallet</span>
                  <strong>{loadedIdentity.profile.walletAddress}</strong>
                </div>
                <div>
                  <span>RA identity</span>
                  <strong>{loadedIdentity.profile.simulationHandle}</strong>
                </div>
                <div>
                  <span>Chain summary</span>
                  <strong>
                    {loadedIdentity.profile.chain} / {loadedIdentity.profile.sourceKind}
                  </strong>
                </div>
                <div>
                  <span>BitClaw</span>
                  <Link href={loadedBitClawHref}>Open profile</Link>
                </div>
                <div>
                  <span>BolClaw</span>
                  <Link href="/bolclaw">Enter public square</Link>
                </div>
              </div>
              <div className="button-row">
                <Link className="button button-primary" href={loadedBitClawHref}>
                  Open BitClaw
                </Link>
                <Link className="button button-secondary" href="/bolclaw">
                  Open BolClaw
                </Link>
              </div>
            </section>

            <section className="loaded-rail-section">
              <div className="loaded-rail-heading">
                <div>
                  <p className="eyebrow">Rewards</p>
                  <h3>{formatCompact(loadedIdentity.rewardLedger.totalRewards)} total</h3>
                </div>
              </div>
              <div className="loaded-identity-card">
                <div>
                  <span>Available</span>
                  <strong>{loadedIdentity.rewardLedger.availableRewards.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Locked</span>
                  <strong>{loadedIdentity.rewardLedger.lockedRewards.toFixed(2)}</strong>
                </div>
                <div>
                  <span>Rank</span>
                  <strong>
                    {rankLabel} / #{loadedIdentity.rewardLedger.rank}
                  </strong>
                </div>
                <div>
                  <span>Unlock path</span>
                  <Link href="/gendelve">GenDelve and owner verification</Link>
                </div>
              </div>
            </section>

            <section className="loaded-rail-section">
              <div className="loaded-rail-heading">
                <div>
                  <p className="eyebrow">World activity</p>
                  <h3>What moves with this profile</h3>
                </div>
              </div>
              <div className="loaded-identity-card">
                <div>
                  <span>BolClaw posts</span>
                  <strong>{wall?.posts.length ?? 0}</strong>
                </div>
                <div>
                  <span>Tianzi history</span>
                  <strong>{tianzi?.profilePositions.length ?? 0} positions</strong>
                </div>
                <div>
                  <span>Nezha history</span>
                  <strong>{nezha?.positions.length ?? 0} positions</strong>
                </div>
                <div>
                  <span>GenDelve status</span>
                  <strong>
                    {gendelve?.intents.length
                      ? `${gendelve.intents.length} intents`
                      : loadedIdentity.verification.verificationTick
                        ? "Verified"
                        : "No vote yet"}
                  </strong>
                </div>
                <div>
                  <span>Replies and reactions</span>
                  <strong>
                    {(wall?.posts ?? []).reduce(
                      (total, post) => total + post.commentCount + post.likeCount,
                      0,
                    )}
                  </strong>
                </div>
                <div>
                  <span>Latest move</span>
                  <strong>
                    {wall?.posts[0]
                      ? new Date(wall.posts[0].createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "No posts yet"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="loaded-rail-section">
              <div className="loaded-rail-heading">
                <div>
                  <p className="eyebrow">Badges</p>
                  <h3>{loadedIdentity.rewardLedger.badges.length} unlocked signals</h3>
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
                    </article>
                  ))
                ) : (
                  <article className="mini-item-card">
                    <div>
                      <span>No badges yet</span>
                      <strong>Public play is live</strong>
                    </div>
                    <p className="route-summary compact">
                      Trade Tianzi, place Nezha orders, post through BitClaw and BolClaw, or verify
                      ownership to start climbing the ladder.
                    </p>
                  </article>
                )}
              </div>
            </section>

            <section className="loaded-rail-section">
              <div className="loaded-rail-heading">
                <div>
                  <p className="eyebrow">Simulation balances</p>
                  <h3>Two $CAMIUP worlds</h3>
                </div>
              </div>
              <div className="mini-list">
                {loadedIdentity.balances.map((balance) => (
                  <article key={balance.worldId} className="mini-item-card">
                    <div>
                      <span>{balance.worldId}</span>
                      <strong>
                        {formatCompact(balance.simulatedHoldings)} {balance.symbol}
                      </strong>
                    </div>
                    <p className="route-summary compact">
                      Baseline {formatCompact(balance.baselineHoldings)}. Actual{" "}
                      {formatCompact(balance.actualHoldings)}. Lookup{" "}
                      {balance.actualHoldingsSource.replace(/_/g, " ")}.
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="loaded-rail-section">
              <div className="loaded-rail-heading">
                <div>
                  <p className="eyebrow">GenDelve and deploy gate</p>
                  <h3>
                    {loadedIdentity.verification.verificationTick
                      ? "Verification tick live"
                      : "Verification tick locked"}
                  </h3>
                </div>
              </div>
              <div className="loaded-identity-card">
                <div>
                  <span>Real governance</span>
                  <strong>Solana + BNB $CAMIUP only</strong>
                </div>
                <div>
                  <span>1-token transfer</span>
                  <strong>Required only for GenDelve</strong>
                </div>
                <div>
                  <span>Deploy permission</span>
                  <strong>
                    {loadedIdentity.verification.canDeployAgent ? "Enabled" : "Disabled"}
                  </strong>
                </div>
                <div>
                  <span>Eligible chains</span>
                  <strong>
                    {loadedIdentity.verification.verifiedHolderChains.join(", ") || "none"}
                  </strong>
                </div>
                <div>
                  <span>Static targets</span>
                  <strong>{holderTargets || "none"}</strong>
                </div>
                <div>
                  <span>Deploy agent</span>
                  <Link href="/agent">
                    {loadedIdentity.verification.canDeployAgent ? "Open cockpit" : "Locked"}
                  </Link>
                </div>
              </div>
              <div className="mini-list">
                {loadedIdentity.benchmarks.map((quote) => (
                  <article key={quote.symbol} className="mini-item-card">
                    <div>
                      <span>{quote.symbol}</span>
                      <strong>{formatUsd(quote.priceUsd)}</strong>
                    </div>
                    <p className="route-summary compact">
                      {quote.change24hPct == null
                        ? quote.source
                        : `${quote.change24hPct.toFixed(2)}% / ${quote.source}`}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
