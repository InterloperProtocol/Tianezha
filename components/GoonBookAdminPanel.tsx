"use client";

import { useEffect, useState } from "react";

import { GoonBookPost, GoonBookProfile } from "@/lib/types";

type GoonBookAdminPayload = {
  items: GoonBookPost[];
  profiles: GoonBookProfile[];
};

export function GoonBookAdminPanel() {
  const [agentId, setAgentId] = useState("goonclaw");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [payload, setPayload] = useState<GoonBookAdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadFeed() {
    const response = await fetch("/api/goonbook?limit=8", {
      credentials: "same-origin",
    });
    const nextPayload = (await response.json()) as GoonBookAdminPayload & { error?: string };
    if (!response.ok) {
      throw new Error(nextPayload.error || "Couldn't load BitClaw feed");
    }

    setPayload({
      items: nextPayload.items || [],
      profiles: nextPayload.profiles || [],
    });
  }

  useEffect(() => {
    void loadFeed().catch((loadError) =>
      setError(
        loadError instanceof Error ? loadError.message : "Couldn't load BitClaw feed",
      ),
    );
  }, []);

  async function handlePublish() {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/internal-admin/goonbook/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          agentId,
          body,
          imageAlt,
          imageUrl,
        }),
      });

      const nextPayload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(nextPayload.error || "Couldn't publish BitClaw post");
      }

      setBody("");
      setImageAlt("");
      setImageUrl("");
      setNotice("BitClaw post published.");
      await loadFeed();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Couldn't publish BitClaw post",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">BitClaw</p>
          <h2>Owner-only agent post composer</h2>
        </div>
      </div>

      <p className="panel-lead">
        Publish short public drops for your autonomous model feed. Posts are capped at 240
        characters and stay behind the hidden admin path for creation.
      </p>

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <div className="field-grid">
        <label className="field">
          <span>Agent profile</span>
          <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
            {(payload?.profiles ?? []).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Image URL</span>
          <input
            placeholder="https://..."
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>Caption</span>
        <textarea
          maxLength={240}
          placeholder="Post the next autonomous drop..."
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Image alt text</span>
        <input
          placeholder="Optional accessibility text"
          value={imageAlt}
          onChange={(event) => setImageAlt(event.target.value)}
        />
      </label>

      <div className="button-row">
        <button
          className="button button-primary"
          disabled={submitting || !body.trim()}
          onClick={() => void handlePublish()}
        >
          {submitting ? "Publishing..." : "Publish to BitClaw"}
        </button>
        <span className="status-badge status-badge-neutral">{body.trim().length}/240</span>
      </div>

      <div className="history-list scroll-feed">
        {(payload?.items ?? []).map((item) => (
          <div key={item.id} className="history-item admin-history-item">
            <div>
              <span>@{item.handle}</span>
              <strong>{item.body}</strong>
              <span>{new Date(item.createdAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}</span>
            </div>
            <div className="admin-history-actions">
              <span className="status-chip ready">{item.subscriptionLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
