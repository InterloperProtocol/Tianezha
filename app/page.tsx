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
        eyebrow="Surface Map"
        title="Retro shell, modern ergonomics."
        summary={
          <>
            GoonClaw is a control network with distinct jobs: private operator
            work on <strong>/goonclaw</strong>, public trust and queue flow on
            <strong> /livestream</strong>, fast wallet review on
            <strong> /eligibility</strong>, and readiness diagnostics on
            <strong> /agent</strong>. Guest access stays open until{" "}
            {freeUntilLabel}.
          </>
        }
        badges={[
          "Start from the user job",
          "Status visible at all times",
          "Consistent console patterns",
          "Accessibility built in",
        ]}
        actions={
          <div className="button-row">
            <Link className="button button-primary" href="/goonclaw">
              Open Personal
            </Link>
            <Link className="button button-secondary" href="/livestream">
              Open Livestream
            </Link>
            <Link className="button button-ghost" href="/eligibility">
              Check Eligibility
            </Link>
          </div>
        }
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Default token</p>
              <strong>{config.NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL}</strong>
              <span>Shared across chart, stream, and eligibility surfaces.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Support</p>
              <strong>Autoblow / Handy / REST</strong>
              <span>Operator controls stay explicit and text-labeled.</span>
            </div>
          </div>
        }
      />

      <section className="surface-grid">
        <section className="surface-card">
          <p className="eyebrow">Private operator</p>
          <h2>/goonclaw</h2>
          <p>Dense personal console for chart sync, media monitoring, and direct device control.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="success">Operator surface</StatusBadge>
            <Link className="surface-card-link" href="/goonclaw">
              Enter console
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">Public room</p>
          <h2>/livestream</h2>
          <p>Trust-first queue and payment surface with live status, stream context, and request visibility.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="accent">Queue surface</StatusBadge>
            <Link className="surface-card-link" href="/livestream">
              Open public room
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">Verification</p>
          <h2>/eligibility</h2>
          <p>Single-purpose manual claim flow for checking a wallet and issuing the subscription cNFT.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="warning">Manual review</StatusBadge>
            <Link className="surface-card-link" href="/eligibility">
              Review wallet
            </Link>
          </div>
        </section>

        <section className="surface-card">
          <p className="eyebrow">Diagnostics</p>
          <h2>/agent</h2>
          <p>Readiness, reference stack, model state, and policy visibility for the hosted agent side.</p>
          <div className="surface-card-footer">
            <StatusBadge tone="neutral">Audit trail</StatusBadge>
            <Link className="surface-card-link" href="/agent">
              View diagnostics
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
                <p className="eyebrow">Operating model</p>
                <h2>Use the right density for the job</h2>
              </div>
            </div>
            <p className="hero-summary">
              Personal is the dense operator console. Livestream is the public
              queue room. Eligibility stays focused on a single decision.
              Agent surfaces prioritize readiness and auditability over control.
            </p>
            <div className="route-badges">
              <StatusBadge tone="accent">Status first</StatusBadge>
              <StatusBadge tone="neutral">Recognition over recall</StatusBadge>
              <StatusBadge tone="success">Keyboard-safe</StatusBadge>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
