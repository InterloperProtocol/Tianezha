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
    url.searchParams.set("chartStyle", "0");
    url.searchParams.set("chartType", "usd");
    url.searchParams.set("interval", "15");
    url.searchParams.set("loadChartSettings", "0");
    url.searchParams.set("chartLeftToolbar", "0");
    url.searchParams.set("info", "0");
    url.searchParams.set("tabs", "0");
    url.searchParams.set("footer", "0");
    url.searchParams.set("trades", "0");
    url.searchParams.set("chartDefaultOnMobile", "1");
    return url.toString();
  } catch {
    return `${fallbackUrl}?embed=1&theme=dark&chartTheme=dark&chartStyle=0&chartType=usd&interval=15&loadChartSettings=0&chartLeftToolbar=0&info=0&tabs=0&footer=0&trades=0&chartDefaultOnMobile=1`;
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
  const pairUrl =
    snapshot?.pairUrl || `https://dexscreener.com/solana/${trimmedContractAddress}`;

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

      {snapshot ? (
        <div className="chart-details">
          <div className="chart-stats chart-stats-grid">
            <div>
              <span>Token</span>
              <strong>
                {snapshot.symbol} · {snapshot.name}
              </strong>
            </div>
            <div>
              <span>Price</span>
              <strong>${snapshot.priceUsd.toFixed(6)}</strong>
            </div>
            <div>
              <span>5m</span>
              <strong className={snapshot.change5mPct >= 0 ? "text-up" : "text-down"}>
                {snapshot.change5mPct >= 0 ? "+" : ""}
                {snapshot.change5mPct.toFixed(2)}%
              </strong>
            </div>
            <div>
              <span>1h</span>
              <strong className={snapshot.change1hPct >= 0 ? "text-up" : "text-down"}>
                {snapshot.change1hPct >= 0 ? "+" : ""}
                {snapshot.change1hPct.toFixed(2)}%
              </strong>
            </div>
            <div>
              <span>Liquidity</span>
              <strong>${snapshot.liquidityUsd.toLocaleString("en-US")}</strong>
            </div>
            <div>
              <span>24h volume</span>
              <strong>${snapshot.volume24hUsd.toLocaleString("en-US")}</strong>
            </div>
          </div>

          <div className="button-row">
            <a
              className="button button-primary small"
              href={pairUrl}
              target="_blank"
              rel="noreferrer"
            >
              Buy on DexScreener
            </a>
            <a
              className="button button-secondary small"
              href={pairUrl}
              target="_blank"
              rel="noreferrer"
            >
              Sell on DexScreener
            </a>
            <a
              className="button button-ghost small"
              href={pairUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open pair
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
