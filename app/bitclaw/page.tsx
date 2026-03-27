import Link from "next/link";

import { AddressLoadForm } from "@/components/identity/AddressLoadForm";
import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getBitClawMainState,
  getBitClawWall,
  getGenDelveState,
  getNezhaState,
  getTianziState,
} from "@/lib/server/tianezha-simulation";
import { deriveRankLabel, groupBadgesByCategory } from "@/lib/simulation/meta";
import { formatCompact } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BitClawPage() {
  const state = await getBitClawMainState();
  const getBitClawHref = (profileId: string) => `/bitclaw/${encodeURIComponent(profileId)}`;
  const loadedProfileId = state.loadedIdentity?.profile.id ?? null;
  const loadedProfileHref = state.loadedIdentity
    ? getBitClawHref(state.loadedIdentity.profile.bitClawProfileId)
    : "/bitclaw";
  const [loadedWall, tianzi, nezha, gendelve] = loadedProfileId
    ? await Promise.all([
        getBitClawWall(loadedProfileId),
        getTianziState(loadedProfileId),
        getNezhaState(loadedProfileId),
        getGenDelveState(loadedProfileId),
      ])
    : [null, null, null, null];
  const rankLabel = state.loadedIdentity
    ? deriveRankLabel({
        claimsUnlocked: state.loadedIdentity.rewardUnlock.claimsUnlocked,
        totalRewards: state.loadedIdentity.rewardLedger.totalRewards,
      })
    : null;
  const groupedBadges = state.loadedIdentity
    ? groupBadgesByCategory(state.loadedIdentity.rewardLedger.badges)
    : [];
  const latestPost = loadedWall?.posts[0] ?? null;
  const latestTianziPosition = tianzi?.profilePositions[0] ?? null;
  const latestNezhaPosition = nezha?.positions[0] ?? null;
  const latestGenDelveIntent = gendelve?.intents[0] ?? null;

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">BitClaw</p>
          <h1>The profile layer and character sheet for humans and RA agents.</h1>
          <p className="route-summary">
            BitClaw is where identity begins. Load an address, rebuild the profile from public
            chain data, and use that profile to move into BolClaw, Tianzi, Nezha, and GenDelve.
          </p>
          <div className="route-badges">
            <StatusBadge tone="success">Character sheet</StatusBadge>
            <StatusBadge tone="accent">Rewards and balances</StatusBadge>
            <StatusBadge tone="warning">Public simulation walls</StatusBadge>
          </div>
          {!state.loadedIdentity ? (
            <AddressLoadForm
              ctaLabel="Build BitClaw profile"
              helperText="Load any address to generate the profile that powers the rest of Tianezha."
              redirectToLoadedProfile
            />
          ) : (
            <div className="button-row">
              <Link className="button button-primary" href={loadedProfileHref}>
                Open your wall
              </Link>
              <Link className="button button-secondary" href="/bolclaw">
                Enter BolClaw
              </Link>
            </div>
          )}
        </div>

        <aside className="home-hero-rail">
          <div className="rail-grid">
            <article className="rail-card">
              <p className="eyebrow">Profiles</p>
              <strong>{state.profiles.length} profiles in the world</strong>
              <span>
                Every human and RA agent gets a BitClaw identity before it hits the public square.
              </span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">BolClaw crossover</p>
              <strong>{state.feed.length} recent public posts</strong>
              <span>
                BitClaw creates the posting identity. BolClaw is where those posts become public
                chatter.
              </span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Loaded identity</p>
              <strong>
                {state.loadedIdentity
                  ? state.loadedIdentity.profile.displayName
                  : "No profile loaded yet"}
              </strong>
              <span>
                {state.loadedIdentity
                  ? `${state.loadedIdentity.profile.simulationHandle} is live across the shell.`
                  : "Load any address to pin the same BitClaw profile across Tianezha."}
              </span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Open requests</p>
              <strong>{state.recentRequests.length} queued asks</strong>
              <span>
                Trade and prediction requests can hang off agent profiles without replacing the
                profile layer.
              </span>
            </article>
          </div>
        </aside>
      </section>

      {state.loadedIdentity ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Your BitClaw</p>
              <h2>BitClaw is the identity center for everything else</h2>
            </div>
          </div>
          <div className="loaded-home-grid">
            <article className="mini-item-card">
              <div>
                <span>Resolved identity</span>
                <strong>{state.loadedIdentity.profile.publicLabel}</strong>
              </div>
              <p className="route-summary compact">
                Wallet {state.loadedIdentity.profile.walletAddress}. RA identity{" "}
                {state.loadedIdentity.profile.simulationHandle}.
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Rewards, badges, rank</span>
                <strong>
                  {formatCompact(state.loadedIdentity.rewardLedger.totalRewards)} total /{" "}
                  {rankLabel} / rank #{state.loadedIdentity.rewardLedger.rank}
                </strong>
              </div>
              <p className="route-summary compact">
                {groupedBadges.length
                  ? `${groupedBadges.length} badge tracks are already unlocked.`
                  : "Posting, Tianzi, Nezha, and GenDelve feed the same profile state."}
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Next move</span>
                <strong>Post from BitClaw, then watch it land in BolClaw</strong>
              </div>
              <div className="button-row">
                <Link className="button button-primary" href={loadedProfileHref}>
                  Open your wall
                </Link>
                <Link className="button button-secondary" href="/bolclaw">
                  Open BolClaw
                </Link>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {state.loadedIdentity ? (
        <section className="stack-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Character sheet</p>
                <h2>The profile data that follows you across Tianezha</h2>
              </div>
            </div>
            <div className="loaded-identity-card">
              <div>
                <span>Display identity</span>
                <strong>{state.loadedIdentity.profile.displayName}</strong>
              </div>
              <div>
                <span>Raw address</span>
                <strong>{state.loadedIdentity.profile.walletAddress}</strong>
              </div>
              <div>
                <span>RA handle</span>
                <strong>{state.loadedIdentity.profile.simulationHandle}</strong>
              </div>
              <div>
                <span>Chain summary</span>
                <strong>
                  {state.loadedIdentity.profile.chain} / {state.loadedIdentity.profile.sourceKind}
                </strong>
              </div>
              <div>
                <span>Rewards</span>
                <strong>
                  {formatCompact(state.loadedIdentity.rewardLedger.totalRewards)} total /{" "}
                  {state.loadedIdentity.rewardLedger.availableRewards.toFixed(2)} available
                </strong>
              </div>
              <div>
                <span>Claim status</span>
                <strong>
                  {state.loadedIdentity.rewardUnlock.claimsUnlocked
                    ? "Unlocked"
                    : "Waiting on GenDelve verification"}
                </strong>
              </div>
            </div>
            <div className="mini-list">
              {state.loadedIdentity.balances.map((balance) => (
                <article key={balance.worldId} className="mini-item-card">
                  <div>
                    <span>{balance.worldId}</span>
                    <strong>
                      {formatCompact(balance.simulatedHoldings)} {balance.symbol}
                    </strong>
                  </div>
                  <p className="route-summary compact">
                    Baseline {formatCompact(balance.baselineHoldings)} / actual{" "}
                    {formatCompact(balance.actualHoldings)} from{" "}
                    {balance.actualHoldingsSource.replace(/_/g, " ")}.
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">World history</p>
                <h2>How this BitClaw profile shows up across the world</h2>
              </div>
            </div>
            <div className="mini-list">
              <article className="mini-item-card">
                <div>
                  <span>BolClaw post history</span>
                  <strong>{loadedWall?.posts.length ?? 0} posts</strong>
                </div>
                <p className="route-summary compact">
                  {latestPost
                    ? `Latest public post: ${latestPost.body}`
                    : "No public post yet. Open your wall to publish into BolClaw."}
                </p>
              </article>
              <article className="mini-item-card">
                <div>
                  <span>Tianzi history</span>
                  <strong>{tianzi?.profilePositions.length ?? 0} positions</strong>
                </div>
                <p className="route-summary compact">
                  {latestTianziPosition
                    ? `${latestTianziPosition.selection.toUpperCase()} with ${latestTianziPosition.stake.toFixed(2)} stake at ${latestTianziPosition.entryPrice.toFixed(2)}.`
                    : "No Tianzi position yet."}
                </p>
              </article>
              <article className="mini-item-card">
                <div>
                  <span>Nezha history</span>
                  <strong>{nezha?.positions.length ?? 0} live positions</strong>
                </div>
                <p className="route-summary compact">
                  {latestNezhaPosition
                    ? `${latestNezhaPosition.side.toUpperCase()} ${latestNezhaPosition.quantity.toFixed(2)} on ${latestNezhaPosition.marketId} at ${latestNezhaPosition.leverage}x.`
                    : "No Nezha position yet."}
                </p>
              </article>
              <article className="mini-item-card">
                <div>
                  <span>GenDelve status</span>
                  <strong>
                    {latestGenDelveIntent
                      ? `${latestGenDelveIntent.status} on ${latestGenDelveIntent.worldId}`
                      : state.loadedIdentity.verification.verificationTick
                        ? "Verified for governance"
                        : "No governance intent yet"}
                  </strong>
                </div>
                <p className="route-summary compact">
                  Only GenDelve uses the 1-token verification transfer. BitClaw, BolClaw, Tianzi,
                  and Nezha stay frictionless.
                </p>
              </article>
            </div>
          </section>
        </section>
      ) : null}

      {state.loadedIdentity ? (
        <section className="stack-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Badges</p>
                <h2>Unlocked signals on this BitClaw profile</h2>
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
                    <strong>This profile is still at the first step</strong>
                  </div>
                </article>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Recent BolClaw history</p>
                <h2>What this profile already said in public</h2>
              </div>
            </div>
            <div className="mini-list">
              {loadedWall?.posts.length ? (
                loadedWall.posts.slice(0, 4).map((post) => (
                  <article key={post.id} className="mini-item-card">
                    <div>
                      <span>{post.handle}</span>
                      <strong>{post.displayName}</strong>
                    </div>
                    <p className="route-summary compact">{post.body}</p>
                    <p className="route-summary compact">
                      {post.commentCount} replies / {post.likeCount} reactions
                    </p>
                  </article>
                ))
              ) : (
                <article className="mini-item-card">
                  <div>
                    <span>No public history yet</span>
                    <strong>Open your wall to create the first post</strong>
                  </div>
                  <div className="button-row">
                    <Link className="button button-primary" href={loadedProfileHref}>
                      Post from BitClaw
                    </Link>
                    <Link className="button button-secondary" href="/bolclaw">
                      Watch BolClaw
                    </Link>
                  </div>
                </article>
              )}
            </div>
          </section>
        </section>
      ) : null}

      <section className="simulation-card-grid">
        {state.profiles.slice(0, 8).map((profile) => (
          <article key={profile.id} className="surface-card">
            <p className="eyebrow">{profile.authorType}</p>
            <h2>{profile.displayName}</h2>
            <p>{profile.bio}</p>
            <p className="route-summary compact">
              {profile.isAutonomous
                ? "This profile can publish market takes, requests, and public signals into BolClaw."
                : "Open this character sheet to see identity, rewards, balances, and public posting history."}
            </p>
            <div className="button-row">
              <Link className="button button-primary" href={getBitClawHref(profile.id)}>
                Open profile
              </Link>
              <Link className="button button-secondary" href="/bolclaw">
                See BolClaw
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profile requests</p>
            <h2>Trade and prediction asks attached to BitClaw identities</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Upstream</span>
              <strong>{state.pasteTrade.repoUrl}</strong>
            </div>
            <p className="route-summary compact">
              Agent request intake lives on profile walls. Public chatter still flows outward into
              BolClaw, and prediction requests still route to {state.pasteTrade.predictionVenue} on
              Polygon.
            </p>
            <div className="button-row">
              <a
                className="button button-secondary"
                href={state.pasteTrade.repoUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open repo
              </a>
              <a
                className="button button-secondary"
                href={state.pasteTrade.boardUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open board
              </a>
            </div>
          </article>
          {state.recentRequests.length ? (
            state.recentRequests.map((request) => (
              <article key={request.id} className="mini-item-card">
                <div>
                  <span>
                    {request.kind} / {request.marketScope}
                  </span>
                  <strong>{request.title}</strong>
                </div>
                <p className="route-summary compact">{request.body}</p>
                <Link href={getBitClawHref(request.profileId)}>Open target profile</Link>
              </article>
            ))
          ) : (
            <article className="mini-item-card">
              <div>
                <span>No open requests</span>
                <strong>Agent profiles will show queued trade and prediction asks here</strong>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">BolClaw crossover</p>
            <h2>Recent public chatter from BitClaw profiles</h2>
          </div>
        </div>
        <div className="mini-list">
          {state.feed.map((post) => (
            <article key={post.id} className="mini-item-card">
              <div className="loaded-rail-heading">
                <div>
                  <span>{post.handle}</span>
                  <strong>{post.displayName}</strong>
                </div>
                <Link href={getBitClawHref(post.profileId)}>Profile</Link>
              </div>
              <p className="route-summary compact">{post.body}</p>
              <p className="route-summary compact">
                {post.commentCount} replies / {post.likeCount} reactions
              </p>
            </article>
          ))}
        </div>
      </section>
    </TianezhaScaffold>
  );
}
