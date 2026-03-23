"use client";

import { SiteNav } from "@/components/SiteNav";
import { LaunchonomicsSection } from "@/components/LaunchonomicsSection";
import { RouteHeader } from "@/components/ui/RouteHeader";

type Props = {
  accessTokenSymbol: string;
  freeAccessUntil: string;
  launchAt: string;
};

export function LaunchonomicsClient({
  accessTokenSymbol,
  freeAccessUntil,
  launchAt,
}: Props) {
  return (
    <div className="app-shell">
      <SiteNav />

      <RouteHeader
        eyebrow="Wallet access"
        title="Check a wallet and see what it unlocks."
        summary={
          <>
            Paste a Solana wallet to check access for {accessTokenSymbol}. If it
            qualifies, you can send access from the same page.
          </>
        }
        badges={[
          "Quick wallet lookup",
          "No wallet connect required",
          "One-screen result",
        ]}
        rail={
          <div className="rail-grid">
            <div className="rail-card">
              <p className="eyebrow">Wallet lookup</p>
              <strong>Paste a Solana address</strong>
              <span>Check access without connecting a wallet.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Claim path</p>
              <strong>Send access from the result</strong>
              <span>If the wallet qualifies, you can issue access from the same screen.</span>
            </div>
          </div>
        }
      />

      <LaunchonomicsSection
        accessTokenSymbol={accessTokenSymbol}
        freeAccessUntil={freeAccessUntil}
        launchAt={launchAt}
      />
    </div>
  );
}
