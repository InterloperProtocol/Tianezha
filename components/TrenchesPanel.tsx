"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";

type TrenchesToken = {
  address: string;
  name: string;
  symbol: string;
  dexId: string;
  pairUrl: string;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange24hPct: number;
  boostScore: number;
  description: string;
  twitterHandle?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  recentPosts: string[];
  narrative: string;
};

type TrenchesPulse = {
  fetchedAt: string;
  nextRefreshAt: string;
  sourceLabel: string;
  summary: string;
  tokens: TrenchesToken[];
};

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatRefresh(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Updating soon";
  }

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrenchesPanel({
  eyebrow = "Monitor the trenches",
  title = "Fresh Solana pump graduates at a glance",
}: {
  eyebrow?: string;
  title?: string;
} = {}) {
  const [pulse, setPulse] = useState<TrenchesPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/trenches");
        const payload = (await response.json()) as TrenchesPulse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Could not load the trench pulse.");
        }

        if (!cancelled) {
          setPulse(payload);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the trench pulse.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 10 * 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const badges = useMemo(() => {
    if (!pulse) {
      return [];
    }

    return [
      <StatusBadge key="source" tone="accent">
        {pulse.sourceLabel}
      </StatusBadge>,
      <StatusBadge key="size" tone="neutral">
        Top {pulse.tokens.length} tokens
      </StatusBadge>,
      <StatusBadge key="refresh" tone="success">
        Refreshes every 10m
      </StatusBadge>,
    ];
  }, [pulse]);

  return (
    <section className="panel trenches-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {loading ? "Loading" : pulse ? "Live pulse" : "Standby"}
        </div>
      </div>

      <p className="hero-summary compact">
        A rolling trench pulse built from public market data, filtered to Solana
        pump-style runners over $100k market cap, with a quick narrative read from
        recent X activity when available.
      </p>

      {badges.length ? <div className="route-badges">{badges}</div> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      {pulse ? (
        <>
          <div className="summary-card">
            <div>
              <span>Pulse summary</span>
              <strong>Next refresh around {formatRefresh(pulse.nextRefreshAt)}</strong>
            </div>
            <p>{pulse.summary}</p>
          </div>

          {pulse.tokens.length ? (
            <div className="token-pulse-list">
              {pulse.tokens.map((token) => (
                <article key={token.address} className="token-pulse-item">
                  <div className="token-pulse-main">
                    <div>
                      <span>{token.symbol}</span>
                      <strong>{token.name}</strong>
                    </div>
                    <div className="token-pulse-stats">
                      <div>
                        <span>MC</span>
                        <strong>{formatCompactUsd(token.marketCapUsd)}</strong>
                      </div>
                      <div>
                        <span>24h vol</span>
                        <strong>{formatCompactUsd(token.volume24hUsd)}</strong>
                      </div>
                      <div>
                        <span>24h move</span>
                        <strong>{token.priceChange24hPct.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>

                  <p>{token.narrative}</p>

                  <div className="token-links">
                    {token.pairUrl ? (
                      <a href={token.pairUrl} target="_blank" rel="noreferrer">
                        View chart
                      </a>
                    ) : null}
                    {token.twitterUrl ? (
                      <a href={token.twitterUrl} target="_blank" rel="noreferrer">
                        @{token.twitterHandle}
                      </a>
                    ) : null}
                    {token.websiteUrl ? (
                      <a href={token.websiteUrl} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    ) : null}
                  </div>

                  {token.recentPosts.length ? (
                    <div className="token-posts">
                      {token.recentPosts.slice(0, 3).map((post, index) => (
                        <div key={`${token.address}-${index}`} className="token-post">
                          {post}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="embed-placeholder compact">
              <strong>No trench runners cleared the filter yet.</strong>
              <p>Once fresh Solana pump-style tokens clear $100k market cap, they’ll appear here.</p>
            </div>
          )}
        </>
      ) : !loading && !error ? (
        <div className="embed-placeholder compact">
          <strong>The trench pulse is warming up.</strong>
          <p>Give it a moment and the latest token list will appear here.</p>
        </div>
      ) : null}
    </section>
  );
}
