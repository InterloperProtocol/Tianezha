"use client";

import { useEffect, useMemo, useState } from "react";

import { ChartSnapshot } from "@/lib/types";
import { formatCompact, formatUsd } from "@/lib/utils";

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
    url.searchParams.set("chartStyle", "0");
    url.searchParams.set("chartType", "usd");
    url.searchParams.set("interval", "15");
    url.searchParams.set("loadChartSettings", "0");
    url.searchParams.set("chartLeftToolbar", "0");
    return url.toString();
  } catch {
    return `${fallbackUrl}?embed=1&theme=dark&chartTheme=dark&chartStyle=0&chartType=usd&interval=15&loadChartSettings=0&chartLeftToolbar=0`;
  }
}

export function PriceChart({ contractAddress, onSnapshotChange }: Props) {
  const [snapshot, setSnapshot] = useState<ChartSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);

    const fetchSnapshot = async () => {
      try {
        const response = await fetch(`/api/chart/${contractAddress}`);
        const payload = (await response.json()) as ChartSnapshot & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Chart lookup failed");
        }
        if (!cancelled) {
          setSnapshot(payload);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setSnapshot(null);
          setError(
            fetchError instanceof Error ? fetchError.message : "Chart lookup failed",
          );
        }
      }
    };

    void fetchSnapshot();
    const interval = window.setInterval(fetchSnapshot, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [contractAddress]);

  useEffect(() => {
    onSnapshotChange?.(snapshot);
  }, [onSnapshotChange, snapshot]);

  const embedUrl = useMemo(
    () => buildDexScreenerEmbedUrl(snapshot?.pairUrl, contractAddress),
    [contractAddress, snapshot?.pairUrl],
  );

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Chart Sync</p>
          <h2>
            {contractAddress.slice(0, 4)}...{contractAddress.slice(-4)}
          </h2>
        </div>
        {snapshot ? (
          <div className="source-pill">
            <span className="status-dot" />
            dexscreener
          </div>
        ) : null}
      </div>
      {snapshot ? (
        <div className="chart-stats">
          <div>
            <span>Price</span>
            <strong>{formatUsd(snapshot.priceUsd)}</strong>
          </div>
          <div>
            <span>Market Cap</span>
            <strong>{formatCompact(snapshot.marketCapUsd)}</strong>
          </div>
          <div>
            <span>5m</span>
            <strong className={snapshot.change5mPct >= 0 ? "text-up" : "text-down"}>
              {snapshot.change5mPct.toFixed(2)}%
            </strong>
          </div>
          <div>
            <span>24h Volume</span>
            <strong>{formatCompact(snapshot.volume24hUsd)}</strong>
          </div>
        </div>
      ) : null}
      {error ? <p className="error-banner">{error}</p> : null}
      <div className="chart-surface">
        <iframe
          key={embedUrl}
          className="chart-frame"
          src={embedUrl}
          title={`DexScreener chart for ${contractAddress}`}
          loading="lazy"
          allowFullScreen
        />
      </div>
      {snapshot ? (
        <a
          className="chart-link"
          href={snapshot.pairUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open pair in DexScreener
        </a>
      ) : null}
    </section>
  );
}
