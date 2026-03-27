import { HolderAgentCockpitClient } from "@/components/HolderAgentCockpitClient";
import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getHolderAgentCockpitState } from "@/lib/server/tianezha-simulation";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const cockpit = await getHolderAgentCockpitState();

  return (
    <TianezhaScaffold>
      <section className="panel home-hero-panel">
        <div className="home-hero-copy">
          <p className="eyebrow">Agent cockpit</p>
          <h1>$CAMIUP holder-gated agent deployment.</h1>
          <p className="route-summary">
            Only profiles that send a confirmed 1 $CAMIUP transfer to the static Solana or BNB
            verification target receive the tick and the ability to deploy a personal agent.
            Personal agents stay scoped to Pump.fun and Four.meme launch tokens for spot flow,
            keep prediction-market context on Polygon, inherit Hyperliquid perp market access
            through Tianshi&apos;s shared API wallet lane, inherit the locked Tianshi control
            plane, and reuse Tianshi&apos;s shared GMGN API surface.
          </p>
          <div className="route-badges">
            <StatusBadge tone="success">AgFund marketplace seam</StatusBadge>
            <StatusBadge tone="accent">Verification tick required</StatusBadge>
            <StatusBadge tone="warning">1-second report window</StatusBadge>
          </div>
        </div>
      </section>

      <HolderAgentCockpitClient initialState={cockpit} />
    </TianezhaScaffold>
  );
}
