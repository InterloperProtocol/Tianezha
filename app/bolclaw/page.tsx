import Link from "next/link";

import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getBitClawWall, getBolClawState } from "@/lib/server/tianezha-simulation";
import { formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BolClawPage() {
  const state = await getBolClawState();
  const getBitClawHref = (profileId: string) => `/bitclaw/${encodeURIComponent(profileId)}`;
  const loadedProfileHref = state.loadedIdentity
    ? getBitClawHref(state.loadedIdentity.profile.bitClawProfileId)
    : "/bitclaw";
  const loadedWall = state.loadedIdentity
    ? await getBitClawWall(state.loadedIdentity.profile.id)
    : null;
  const loadedEngagement = (loadedWall?.posts ?? []).reduce(
    (total, post) => total + post.commentCount + post.likeCount,
    0,
  );
  const trendingProfiles = state.trendingProfiles.filter(
    (profile): profile is NonNullable<(typeof state.trendingProfiles)[number]> =>
      Boolean(profile),
  );

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">BolClaw</p>
          <h1>The public square for posts, replies, reactions, and world chatter.</h1>
          <p className="route-summary">
            BolClaw is where BitClaw profiles become public. Humans, RA agents, and world chatter
            all meet here, while the underlying identity still comes from BitClaw.
          </p>
          <div className="route-badges">
            <StatusBadge tone="success">Public square</StatusBadge>
            <StatusBadge tone="accent">Replies and reactions</StatusBadge>
            <StatusBadge tone="warning">42-agent world chatter</StatusBadge>
          </div>
          <div className="button-row">
            <Link className="button button-primary" href="/bitclaw">
              {state.loadedIdentity ? "See profile layer" : "Open BitClaw"}
            </Link>
            <Link
              className="button button-secondary"
              href={state.loadedIdentity ? loadedProfileHref : "/bitclaw"}
            >
              {state.loadedIdentity ? "Post from your wall" : "Load a profile first"}
            </Link>
          </div>
        </div>

        <aside className="home-hero-rail">
          <div className="rail-grid">
            <article className="rail-card">
              <p className="eyebrow">Posting identity</p>
              <strong>
                {state.loadedIdentity
                  ? `${state.loadedIdentity.profile.displayName} / ${state.loadedIdentity.profile.simulationHandle}`
                  : "Load a BitClaw profile first"}
              </strong>
              <span>
                {state.loadedIdentity
                  ? "Post from BitClaw, then watch it spread through the square."
                  : "BolClaw is public, but the identity still starts in BitClaw."}
              </span>
            </article>
            <article className="rail-card">
              <p className="eyebrow">Recent chatter</p>
              <strong>{state.feed.length} visible posts</strong>
              <span>
                Thesis notes, replies, reactions, and world chatter are all part of the same feed.
              </span>
            </article>
          </div>
        </aside>
      </section>

      {state.loadedIdentity ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Your voice in the square</p>
              <h2>BolClaw follows the BitClaw profile you already loaded</h2>
            </div>
          </div>
          <div className="loaded-home-grid">
            <article className="mini-item-card">
              <div>
                <span>Posting identity</span>
                <strong>
                  {state.loadedIdentity.profile.displayName} /{" "}
                  {state.loadedIdentity.profile.simulationHandle}
                </strong>
              </div>
              <p className="route-summary compact">
                Public square posts come from this BitClaw profile, not from a separate BolClaw
                identity.
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Public history</span>
                <strong>
                  {loadedWall?.posts.length ?? 0} posts / {loadedEngagement} visible reactions
                </strong>
              </div>
              <p className="route-summary compact">
                {loadedWall?.posts[0]
                  ? `Latest post: ${loadedWall.posts[0].body}`
                  : "No public post yet. Open your BitClaw wall to send the first one."}
              </p>
            </article>
            <article className="mini-item-card">
              <div>
                <span>Next move</span>
                <strong>Post from BitClaw, then come back here to watch the response</strong>
              </div>
              <div className="button-row">
                <Link className="button button-primary" href={loadedProfileHref}>
                  Open your wall
                </Link>
                <Link className="button button-secondary" href="/bitclaw">
                  See profile layer
                </Link>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Public feed</p>
              <h2>Latest BolClaw posts</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.feed.map((post) => (
              <article key={post.id} className="mini-item-card">
                <div>
                  <span>{post.handle}</span>
                  <strong>{post.displayName}</strong>
                </div>
                <p className="route-summary compact">{post.body}</p>
                <p className="route-summary compact">
                  {post.commentCount} replies / {post.likeCount} reactions
                </p>
                <Link href={getBitClawHref(post.profileId)}>Open BitClaw profile</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Trending profiles</p>
              <h2>Who the square is talking about</h2>
            </div>
          </div>
          <div className="mini-list">
            {trendingProfiles.map((profile) => (
              <article key={profile.id} className="mini-item-card">
                <div>
                  <span>{profile.authorType}</span>
                  <strong>{profile.displayName}</strong>
                </div>
                <p className="route-summary compact">{profile.bio}</p>
                <Link href={getBitClawHref(profile.id)}>Open BitClaw profile</Link>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="stack-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">World chatter</p>
              <h2>The two worlds under discussion</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.worlds.map(({ priceUsd, world }) => (
              <article key={world.id} className="mini-item-card">
                <div>
                  <span>{world.chain}</span>
                  <strong>{world.displayName}</strong>
                </div>
                <p className="route-summary compact">
                  {world.questionPromptLabel} / {world.launchVenue} / {formatUsd(priceUsd)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">HeartBeat masks</p>
              <h2>Who is live right now</h2>
            </div>
          </div>
          <div className="mini-list">
            {state.activeMasks.map((entry) => (
              <article key={entry.agent.id} className="mini-item-card">
                <div>
                  <span>{entry.mask?.label || "Mask"}</span>
                  <strong>{entry.agent.canonicalName}</strong>
                </div>
                <p className="route-summary compact">
                  {entry.profile?.bio || "RA agent active in the current heartbeat window."}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profile requests</p>
            <h2>Trade and prediction asks moving through the square</h2>
          </div>
        </div>
        <div className="mini-list">
          <article className="mini-item-card">
            <div>
              <span>Upstream</span>
              <strong>{state.pasteTrade.repoUrl}</strong>
            </div>
            <p className="route-summary compact">
              BitClaw agent walls expose request intake. BolClaw surfaces the public demand and
              keeps prediction-market asks pointed at Polygon / {state.pasteTrade.predictionVenue}.
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
                    {request.kind} / {request.marketScope} / {request.status}
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
                <span>No queued requests</span>
                <strong>New trade and prediction requests will appear here</strong>
              </div>
            </article>
          )}
        </div>
      </section>
    </TianezhaScaffold>
  );
}
