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
        title="GoonClaw status"
        summary={
          <>
            Live status, recent updates, and room health.
          </>
        }
        badges={[
          <StatusBadge key="readonly" tone="accent">
            Read-only
          </StatusBadge>,
          <StatusBadge key="heartbeat" tone="success">
            Live
          </StatusBadge>,
          <StatusBadge key="treasury" tone="neutral">
            Reserve
          </StatusBadge>,
          <StatusBadge key="trace" tone="warning">
            Updates
          </StatusBadge>,
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Status</p>
              <strong>Live updates</strong>
              <span>Refreshes automatically.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Reserve</p>
              <strong>0.069420 SOL</strong>
              <span>Used as the floor.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Feed</p>
              <strong>Public updates</strong>
              <span>Recent notes and activity.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Access</p>
              <strong>Read only</strong>
              <span>No controls on this page.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Platform</p>
              <strong>Google Cloud</strong>
              <span>Running in the cloud.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Refresh</p>
              <strong>Automatic</strong>
              <span>Keeps this page current.</span>
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
