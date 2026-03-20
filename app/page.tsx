import Link from "next/link";

import { HomeEligibilityCta } from "@/components/HomeEligibilityCta";
import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function Home() {
  const config = getPublicEnv();
  const freeUntilLabel = new Date(config.NEXT_PUBLIC_FREE_ACCESS_UNTIL).toLocaleString(
    "en-US",
    {
      dateStyle: "long",
      timeStyle: "short",
    },
  );

  return (
    <div className="app-shell">
      <SiteNav />

      <RouteHeader
        eyebrow="Welcome"
        title="Everything you need to run the show."
        summary={
          <>
            GoonClaw brings together personal control, live queue management,
            wallet access checks, and behind-the-scenes platform status in one
            dashboard. Guest access stays open until{" "}
            {freeUntilLabel}.
          </>
        }
        badges={[
          "Fast to scan",
          "Live market context",
          "Simple request flow",
          "Clear wallet access",
        ]}
        actions={
          <div className="button-row">
            <Link className="button button-primary" href="/goonclaw">
              Open Personal
            </Link>
            <Link className="button button-secondary" href="/livestream">
              Open GoonClaw
            </Link>
            <Link className="button button-ghost" href="/goonstreams">
              Browse GoonStreams
            </Link>
            <Link className="button button-ghost" href="/eligibility">
              Check Access
            </Link>
          </div>
        }
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Default token</p>
              <strong>{config.NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL}</strong>
              <span>Used across the chart, live room, and wallet access pages.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Works with</p>
              <strong>Autoblow / Handy / REST</strong>
              <span>Flexible device support for personal sessions.</span>
            </div>
          </div>
        }
      />

      <section className="surface-grid">
        <section className="surface-card">
          <p className="eyebrow">Personal</p>
          <h2>/goonclaw</h2>
          <p>Track the market, keep a video window nearby, and run your saved setup in one place.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="success">Personal dashboard</StatusBadge>
            <Link className="surface-card-link" href="/goonclaw">
              Open dashboard
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">GoonClaw</p>
          <h2>/livestream</h2>
          <p>Run the public queue, collect requests, and keep the live room simple for viewers to follow.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="accent">Public experience</StatusBadge>
            <Link className="surface-card-link" href="/livestream">
              Open GoonClaw
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">GoonStreams</p>
          <h2>/goonstreams</h2>
          <p>See which guest-session public panels are actually live and open any one in read-only mode.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="success">Active streams</StatusBadge>
            <Link className="surface-card-link" href="/goonstreams">
              Open board
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">Wallet access</p>
          <h2>/eligibility</h2>
          <p>Check a Solana wallet and instantly see whether it qualifies for subscription access.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="warning">Fast lookup</StatusBadge>
            <Link className="surface-card-link" href="/eligibility">
              Check wallet
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">Platform status</p>
          <h2>/agent</h2>
          <p>See how payments, access delivery, AI features, and supporting services are doing behind the scenes.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="neutral">System health</StatusBadge>
            <Link className="surface-card-link" href="/agent">
              View status
            </Link>
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-column">
          <HomeEligibilityCta />
        </div>

        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">How it fits together</p>
                <h2>Built for quick decisions</h2>
              </div>
            </div>
            <p className="hero-summary">
              Use Personal for your own setup, GoonClaw for the public queue,
              GoonStreams to browse live public panels, Wallet Access for quick
              yes-or-no checks, and Status when you want to confirm the foundation
              is ready.
            </p>
            <div className="route-badges">
              <StatusBadge tone="accent">Clear at a glance</StatusBadge>
              <StatusBadge tone="neutral">Live updates</StatusBadge>
              <StatusBadge tone="success">Made to feel simple</StatusBadge>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
