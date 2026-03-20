"use client";

import { useEffect, useState } from "react";

import { NewsFeed } from "@/lib/types";

const categories = [
  { id: "solana", label: "Solana" },
  { id: "onchain", label: "Onchain" },
  { id: "trading", label: "Trading" },
  { id: "macro", label: "Macro" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NewsPanel({
  title,
  eyebrow = "News Pulse",
  defaultCategory = "solana",
}: {
  title: string;
  eyebrow?: string;
  defaultCategory?: string;
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/news?category=${encodeURIComponent(category)}&limit=6`,
        );
        const payload = (await response.json()) as NewsFeed & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load market news");
        }

        if (!cancelled) {
          setFeed(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setFeed(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load market news",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [category]);

  return (
    <section className="panel news-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {loading ? "Refreshing" : category}
        </div>
      </div>

      <div className="news-tabs">
        {categories.map((item) => (
          <button
            key={item.id}
            className={
              category === item.id
                ? "button button-primary small"
                : "button button-ghost small"
            }
            onClick={() => setCategory(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="news-list">
        {(feed?.articles ?? []).map((article) => (
          <article key={`${article.link}:${article.pubDate}`} className="news-item">
            <div className="news-meta">
              <span>{article.source}</span>
              <span>{article.timeAgo ?? formatDate(article.pubDate)}</span>
            </div>
            <a href={article.link} target="_blank" rel="noreferrer">
              <strong>{article.title}</strong>
            </a>
            <p>{article.description}</p>
          </article>
        ))}
      </div>

      {!loading && !feed?.articles.length && !error ? (
        <p className="empty-state">
          No articles landed for this lane yet. Try another news category in a
          moment.
        </p>
      ) : null}
    </section>
  );
}
