"use client";

import { useEffect, useState } from "react";

import { NewsFeed } from "@/lib/types";

const categories = [
  { id: "solana", label: "Solana" },
  { id: "onchain", label: "Onchain" },
  { id: "trading", label: "Trading" },
  { id: "macro", label: "Macro" },
];
const CUSTOM_RSS_STORAGE_KEY = "tianshi-news-custom-rss";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NewsPanel({
  title,
  eyebrow = "News",
  defaultCategory = "solana",
}: {
  title: string;
  eyebrow?: string;
  defaultCategory?: string;
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [customFeedDraft, setCustomFeedDraft] = useState("");
  const [customFeeds, setCustomFeeds] = useState<string[]>([]);
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(CUSTOM_RSS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed)) {
        setCustomFeeds(parsed.filter(Boolean));
      }
    } catch {
      setCustomFeeds([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          category,
          limit: "6",
        });
        customFeeds.forEach((feedUrl) => params.append("rss", feedUrl));

        const response = await fetch(`/api/news?${params.toString()}`);
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
  }, [category, customFeeds]);

  function persistFeeds(nextFeeds: string[]) {
    setCustomFeeds(nextFeeds);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CUSTOM_RSS_STORAGE_KEY, JSON.stringify(nextFeeds));
    }
  }

  function addCustomFeed() {
    const trimmed = customFeedDraft.trim();
    if (!trimmed) {
      return;
    }

    try {
      const normalized = new URL(trimmed).toString();
      if (customFeeds.includes(normalized)) {
        setCustomFeedDraft("");
        return;
      }

      setError(null);
      persistFeeds([...customFeeds, normalized]);
      setCustomFeedDraft("");
    } catch {
      setError("Custom RSS feeds need a valid URL.");
    }
  }

  function removeCustomFeed(feedUrl: string) {
    setError(null);
    persistFeeds(customFeeds.filter((value) => value !== feedUrl));
  }

  return (
    <section className="panel news-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {loading
            ? "Refreshing"
            : `${Math.max(feed?.sources.length ?? 0, 0)} sources`}
        </div>
      </div>

      <p className="hero-summary compact">
        Stay close to the market with a live headline mix and your own saved RSS feeds.
      </p>

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
          Nothing new has landed in this lane yet. Try another category in a
          moment.
        </p>
      ) : null}

      <div className="news-controls">
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

        {feed?.sources.length ? (
          <div className="route-badges">
            <span className="status-badge status-badge-accent">Live mix</span>
            <span className="status-badge">
              {feed.sources.length} free sources
            </span>
          </div>
        ) : null}

        <div className="media-toolbar">
          <label className="field">
            <span>Add RSS feed</span>
            <input
              value={customFeedDraft}
              onChange={(event) => setCustomFeedDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomFeed();
                }
              }}
              placeholder="Paste an RSS or Atom feed URL"
            />
          </label>
          <div className="button-row">
            <button className="button button-secondary small" onClick={addCustomFeed} type="button">
              Save feed
            </button>
          </div>
        </div>

        {customFeeds.length ? (
          <div className="history-list compact-scroll-feed news-saved-feeds">
            {customFeeds.map((feedUrl) => (
              <div key={feedUrl} className="history-item">
                <div>
                  <span>Saved feed</span>
                  <strong>{feedUrl}</strong>
                </div>
                <button
                  className="button button-ghost small"
                  onClick={() => removeCustomFeed(feedUrl)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
