"use client";

import { SiteNav } from "@/components/SiteNav";
import { LaunchonomicsSection } from "@/components/LaunchonomicsSection";
import { RouteHeader } from "@/components/ui/RouteHeader";

type Props = {
  accessTokenSymbol: string;
  freeAccessUntil: string;
  launchAt: string;
};

function formatDate(value?: string) {
  if (!value) return "Not configured";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
}

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
              <p className="eyebrow">Open access ends</p>
              <strong>{formatDate(freeAccessUntil)}</strong>
              <span>Open access stays on until then.</span>
            </div>
            <div className="rail-card">
              <p className="eyebrow">Launch window starts</p>
              <strong>{launchAt ? formatDate(launchAt) : "Awaiting config"}</strong>
              <span>This date sets the access window.</span>
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
