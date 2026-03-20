import { AgentOpsPanel } from "@/components/AgentOpsPanel";
import { FaqPanel } from "@/components/FaqPanel";
import { SiteNav } from "@/components/SiteNav";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="app-shell">
      <SiteNav />

      <RouteHeader
        eyebrow="Agent diagnostics"
        title="Readiness, claims, and runtime state."
        summary={
          <>
            This route is the audit surface for the hosted agent side of
            GoonClaw: manual cNFT claims, buyback policy, Vertex runtime
            readiness, payment wiring, and the current reference stack. It is
            intentionally status-heavy and explanatory rather than action-heavy.
          </>
        }
        badges={[
          <StatusBadge key="health" tone="success">
            Health and readiness
          </StatusBadge>,
          <StatusBadge key="audit" tone="neutral">
            Audit trail
          </StatusBadge>,
          <StatusBadge key="manual" tone="warning">
            Manual claim flow
          </StatusBadge>,
          <StatusBadge key="runtime" tone="accent">
            Vertex runtime
          </StatusBadge>,
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Claim mode</p>
              <strong>Manual receive</strong>
              <span>Eligibility first, operator confirmation second.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Polling</p>
              <strong>30 second cadence</strong>
              <span>Runtime and payment readiness stay visible without refresh.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Runtime</p>
              <strong>Vertex AI Gemini</strong>
              <span>Hosted model status belongs here, not on public control routes.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Purpose</p>
              <strong>Readiness + policy</strong>
              <span>Diagnostics, references, and explanations in one separate page.</span>
            </div>
          </div>
        }
      />

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
