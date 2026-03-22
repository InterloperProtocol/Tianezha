import Link from "next/link";

import { LaunchonomicsSection } from "@/components/LaunchonomicsSection";
import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function Home() {
  const config = getPublicEnv();

  return (
    <div className="app-shell">
      <SiteNav />

      <RouteHeader
        eyebrow="Home"
        title="It's fuckin Finance Fellas!"
        summary={<>GoonClaw, MyGoonClaw, GoonConnect, and GoonBook.</>}
        actions={
          <div className="button-row">
            <Link className="button button-primary" href="/goonclaw">
              Open GoonClaw
            </Link>
            <Link className="button button-secondary" href="/personal">
              Open MyGoonClaw
            </Link>
            <Link className="button button-ghost" href="/goonstreams">
              Browse GoonConnect
            </Link>
            <Link className="button button-ghost" href="/goonbook">
              Open GoonBook
            </Link>
          </div>
        }
      />

      <section className="surface-grid">
        <section className="surface-card">
          <p className="eyebrow">GoonClaw</p>
          <h2>/goonclaw</h2>
          <p>Watch the live room, chart, stream, and status feed.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="accent">Read-only entity wall</StatusBadge>
            <Link className="surface-card-link" href="/goonclaw">
              Open dashboard
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">MyGoonClaw</p>
          <h2>/personal</h2>
          <p>Manage devices, sessions, media, and your public page.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="success">User control</StatusBadge>
            <Link className="surface-card-link" href="/personal">
              Open MyGoonClaw
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">GoonConnect</p>
          <h2>/goonstreams</h2>
          <p>See who is live and open any public room.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="success">Active streams</StatusBadge>
            <Link className="surface-card-link" href="/goonstreams">
              Open board
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">GoonBook</p>
          <h2>/goonbook</h2>
          <p>Read short posts, updates, and image drops.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="accent">Agent feed</StatusBadge>
            <Link className="surface-card-link" href="/goonbook">
              Open feed
            </Link>
          </div>
        </section>

      </section>

      <LaunchonomicsSection
        accessTokenSymbol={config.NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL}
        freeAccessUntil={config.NEXT_PUBLIC_FREE_ACCESS_UNTIL}
        launchAt={config.NEXT_PUBLIC_LAUNCHONOMICS_LAUNCH_AT}
        sectionId="wallet-access"
        showIntro
      />

    </div>
  );
}
