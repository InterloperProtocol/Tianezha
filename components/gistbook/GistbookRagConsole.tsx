"use client";

import { useState } from "react";

import type { GistbookRagAnswer } from "@/packages/adapters/src/gistbook";

interface GistbookRagConsoleProps {
  title?: string;
  lead?: string;
  projectId?: string | null;
  sessionId?: string | null;
}

export function GistbookRagConsole({
  title = "Vectorless RAG",
  lead = "Ask the session atlas a question. Retrieval walks a PageIndex tree from summary nodes down to transcript leaves with no embeddings and no vector database.",
  projectId = null,
  sessionId = null,
}: GistbookRagConsoleProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<GistbookRagAnswer | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/gistbook/query", {
        body: JSON.stringify({
          projectId,
          query: trimmed,
          sessionId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as GistbookRagAnswer & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Couldn't query Gistbook");
      }

      setAnswer(payload);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Couldn't query Gistbook",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel gistbook-console-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Gistbook RAG</p>
          <h2>{title}</h2>
        </div>
      </div>
      <p className="panel-lead">{lead}</p>

      <form className="gistbook-console-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Query</span>
          <textarea
            className="gistbook-query-input"
            name="query"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="What changed in the latest dashboard work? Which sessions mention vectorless RAG?"
            value={query}
          />
        </label>
        <div className="button-row">
          <button className="button button-primary" disabled={loading} type="submit">
            {loading ? "Tracing atlas" : "Query atlas"}
          </button>
          {projectId ? <span className="status-badge status-badge-accent">Project scope</span> : null}
          {sessionId ? <span className="status-badge status-badge-success">Session scope</span> : null}
        </div>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}

      {answer ? (
        <div className="gistbook-answer-shell">
          <article className="mini-item-card gistbook-answer-card">
            <div>
              <span>{answer.mode}</span>
              <strong>{answer.query}</strong>
            </div>
            <p className="route-summary compact">{answer.answer}</p>
          </article>

          {answer.path.length ? (
            <div className="gistbook-path-strip">
              {answer.path.map((step, index) => (
                <article key={`${step.title}-${index}`} className="gistbook-path-card">
                  <span>Step {index + 1}</span>
                  <strong>{step.title}</strong>
                  <p>{step.summary}</p>
                </article>
              ))}
            </div>
          ) : null}

          {answer.sources.length ? (
            <div className="gistbook-source-grid">
              {answer.sources.map((source) => (
                <a key={source.id} className="gistbook-source-card" href={source.href}>
                  <span>
                    {source.projectLabel} | score {source.score.toFixed(1)}
                  </span>
                  <strong>{source.title}</strong>
                  <p>{source.summary}</p>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
