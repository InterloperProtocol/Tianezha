import Link from "next/link";

import { HomeEligibilityCta } from "@/components/HomeEligibilityCta";
import { SiteNav } from "@/components/SiteNav";
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

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">GoonClaw</p>
          <h1>Personal and livestream token control, now under one name.</h1>
          <p className="hero-summary">
            GoonClaw combines a private control room, a public livestream panel,
            chart sync, crypto news, and wallet review tools. The guest window
            stays open until {freeUntilLabel}.
          </p>
          <div className="hero-badges">
            <span>Personal room at /goonclaw</span>
            <span>Public livestream queue at /livestream</span>
            <span>Eligibility review at /eligibility</span>
            <span>API-only Autoblow, Handy, and REST support</span>
          </div>
        </div>
        <div className="hero-actions">
          <div className="button-row">
            <Link className="button button-secondary" href="/eligibility">
              Check Eligibility
            </Link>
            <Link className="button button-primary" href="/goonclaw">
              Open Personal
            </Link>
            <Link className="button button-ghost" href="/livestream">
              Open Livestream
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Personal</p>
                <h2>Chart + video + device control</h2>
              </div>
            </div>
            <p className="hero-summary">
              Load your own video or stream embed, pick a device, and drive it
              from a live chart without leaving the control room.
            </p>
            <div className="button-row">
              <Link className="button button-primary" href="/goonclaw">
                Open /goonclaw
              </Link>
            </div>
          </section>

          <HomeEligibilityCta />
        </div>

        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Livestream</p>
                <h2>Stream + chart + payment control</h2>
              </div>
            </div>
            <p className="hero-summary">
              The public room now keeps the stream, chart, queue, and crypto
              news on one surface so paid control requests are easier to follow.
            </p>
            <div className="button-row">
              <Link className="button button-secondary" href="/livestream">
                Go to /livestream
              </Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
