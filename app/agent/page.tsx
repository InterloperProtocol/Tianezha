import { AgentOpsPanel } from "@/components/AgentOpsPanel";
import { FaqPanel } from "@/components/FaqPanel";
import { SiteNav } from "@/components/SiteNav";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="app-shell">
      <SiteNav />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Agent</p>
          <h1>Agent runtime, claims, and buyback policy.</h1>
          <p className="hero-summary">
            This page holds the full agent operations view in one place: manual
            cNFT claim flow, buyback split, Vertex runtime status, and the
            current reference stack behind GoonClaw.
          </p>
          <div className="hero-badges">
            <span>Manual claim flow</span>
            <span>Buyback policy</span>
            <span>Vertex runtime status</span>
            <span>Reference stack</span>
          </div>
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid-secondary">
        <div className="dashboard-column">
          <AgentOpsPanel />
        </div>
        <div className="dashboard-column">
          <FaqPanel />
        </div>
      </section>
    </div>
  );
}
