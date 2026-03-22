"use client";

import { useEffect, useMemo, useState } from "react";

import { ChartSnapshot } from "@/lib/types";

type Props = {
  contractAddress: string;
  onSnapshotChange?: (snapshot: ChartSnapshot | null) => void;
};

function buildDexScreenerEmbedUrl(pairUrl: string | undefined, contractAddress: string) {
  const fallbackUrl = `https://dexscreener.com/solana/${contractAddress}`;

  try {
    const url = new URL(pairUrl || fallbackUrl);
    url.searchParams.set("embed", "1");
    url.searchParams.set("theme", "dark");
    url.searchParams.set("chartTheme", "dark");
    url.searchParams.set("chartDefaultOnMobile", "1");
    return url.toString();
  } catch {
    return `${fallbackUrl}?embed=1&theme=dark&chartTheme=dark&chartDefaultOnMobile=1`;
  }
}

export function PriceChart({ contractAddress, onSnapshotChange }: Props) {
  const [snapshot, setSnapshot] = useState<ChartSnapshot | null>(null);
  const trimmedContractAddress = contractAddress.trim();

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);

    const fetchSnapshot = async () => {
      if (!trimmedContractAddress) {
        return;
      }

      try {
        const response = await fetch(`/api/chart/${trimmedContractAddress}`);
        const payload = (await response.json()) as ChartSnapshot & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Chart lookup failed");
        }
        if (!cancelled) {
          setSnapshot(payload);
        }
      } catch {
        if (!cancelled) {
          setSnapshot(null);
        }
      }
    };

    void fetchSnapshot();
    const interval = window.setInterval(fetchSnapshot, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [trimmedContractAddress]);

  useEffect(() => {
    onSnapshotChange?.(snapshot);
  }, [onSnapshotChange, snapshot]);

  const embedUrl = useMemo(
    () => buildDexScreenerEmbedUrl(snapshot?.pairUrl, trimmedContractAddress),
    [snapshot?.pairUrl, trimmedContractAddress],
  );

  return (
    <section className="panel chart-panel">
      <div className="chart-surface">
        <iframe
          key={embedUrl}
          className="chart-frame"
          src={embedUrl}
          title={`DexScreener chart for ${trimmedContractAddress}`}
          loading="lazy"
          allowFullScreen
        />
      </div>
    </section>
  );
}
