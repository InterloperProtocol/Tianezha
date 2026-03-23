import { AutonomousAgentPanel } from "@/components/AutonomousAgentPanel";
import { FaqPanel } from "@/components/FaqPanel";
import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="app-shell seafoam-theme">
      <SiteNav />

      <RouteHeader
        eyebrow="Status"
        title="Live health for the public runtime."
        summary={
          <>
            Status is the public legibility layer for GoonClaw: live runtime
            health, reserve posture, recent updates, and the serious operating
            surface behind a moderated network.
          </>
        }
        badges={[
          <StatusBadge key="readonly" tone="accent">
            Read-only
          </StatusBadge>,
          <StatusBadge key="heartbeat" tone="success">
            Live health
          </StatusBadge>,
          <StatusBadge key="treasury" tone="neutral">
            Reserve
          </StatusBadge>,
          <StatusBadge key="trace" tone="warning">
            Public legibility
          </StatusBadge>,
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Runtime</p>
              <strong>Live health</strong>
              <span>Refreshes automatically so the public can read the system.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Reserve</p>
              <strong>0.069420 SOL</strong>
              <span>Visible because public systems need visible guardrails.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Feed</p>
              <strong>Public updates</strong>
              <span>Recent notes, activity, and runtime posture.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Moderation</p>
              <strong>Intentional</strong>
              <span>Public surfaces are kept readable without making the copy defensive.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Platform</p>
              <strong>Google Cloud</strong>
              <span>Running in the cloud as the public runtime layer.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Refresh</p>
              <strong>Automatic</strong>
              <span>Keeps this page current without exposing private controls.</span>
            </div>
          </div>
        }
      />

      <section className="dashboard-grid dashboard-grid-secondary">
        <div className="dashboard-column">
          <AutonomousAgentPanel />
        </div>
        <div className="dashboard-column">
          <FaqPanel />
        </div>
      </section>
    </div>
  );
}
