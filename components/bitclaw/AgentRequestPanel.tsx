"use client";

import { FormEvent, useState } from "react";

import type { AgentTradeRequest, PasteTradeIntegration } from "@/lib/simulation/types";

type RequestKind = AgentTradeRequest["kind"];

export function AgentRequestPanel({
  initialRequests,
  pasteTrade,
  profileId,
}: {
  initialRequests: AgentTradeRequest[];
  pasteTrade: PasteTradeIntegration;
  profileId: string;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [kind, setKind] = useState<RequestKind>("paste-trade");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/bitclaw/profiles/${encodeURIComponent(profileId)}/requests`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            body,
            kind,
            sourceUrl,
            title,
          }),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        state?: {
          requests: AgentTradeRequest[];
        };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit that request.");
      }

      setRequests(payload.state?.requests || []);
      setTitle("");
      setBody("");
      setSourceUrl("");
      setKind("paste-trade");
      setNotice("Request queued on the wall.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to submit that request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Paste.trade intake</p>
          <h2>Trade and prediction requests for this agent</h2>
        </div>
      </div>

      <div className="mini-list">
        <article className="mini-item-card">
          <div>
            <span>Upstream</span>
            <strong>paste.trade repo and live board</strong>
          </div>
          <p className="route-summary compact">{pasteTrade.note}</p>
          <div className="button-row">
            <a className="button button-secondary" href={pasteTrade.repoUrl} rel="noreferrer" target="_blank">
              Open repo
            </a>
            <a className="button button-secondary" href={pasteTrade.boardUrl} rel="noreferrer" target="_blank">
              Open board
            </a>
          </div>
        </article>

        <article className="mini-item-card">
          <div>
            <span>Command flow</span>
            <strong>{pasteTrade.tradeCommandExample}</strong>
          </div>
          <p className="route-summary compact">
            Update flow: <code>{pasteTrade.updateCommandExample}</code>. Prediction requests route
            through {pasteTrade.predictionVenue} on Polygon.
          </p>
        </article>

        <article className="mini-item-card">
          <div>
            <span>Supported upstream venues</span>
            <strong>{pasteTrade.supportedVenues.join(", ")}</strong>
          </div>
          <p className="route-summary compact">
            Tianezha uses this layer for intake and research. Local execution still stays inside
            the existing Tianshi venue and risk constraints.
          </p>
        </article>
      </div>

      <form className="trade-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Request type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as RequestKind)}>
            <option value="paste-trade">Paste.trade source request</option>
            <option value="prediction-market">Prediction-market request</option>
          </select>
        </label>

        <label className="field">
          <span>Title</span>
          <input
            maxLength={96}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              kind === "prediction-market"
                ? "Which event should this agent price?"
                : "Which source or thesis should this agent turn into a trade?"
            }
            value={title}
          />
        </label>

        <label className="field">
          <span>Source URL</span>
          <input
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://x.com/... or https://polymarket.com/..."
            value={sourceUrl}
          />
        </label>

        <label className="field">
          <span>Request body</span>
          <textarea
            maxLength={600}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              kind === "prediction-market"
                ? "Describe the event, timing, and why this should become a Polygon prediction-market request."
                : "Paste the thesis, source summary, or what you want the agent to route through paste.trade."
            }
            value={body}
          />
        </label>

        <div className="trade-form-actions">
          <button
            className="button button-primary"
            disabled={submitting || !title.trim() || !body.trim()}
            type="submit"
          >
            {submitting ? "Submitting..." : "Submit request"}
          </button>
          {notice ? <p className="toast-banner">{notice}</p> : null}
          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </form>

      <div className="mini-list">
        {requests.length ? (
          requests.map((request) => (
            <article key={request.id} className="mini-item-card">
              <div>
                <span>
                  {request.kind} / {request.marketScope} / {request.status}
                </span>
                <strong>{request.title}</strong>
              </div>
              <p className="route-summary compact">{request.body}</p>
              <p className="route-summary compact">
                Filed {new Date(request.createdAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {request.requesterProfileId ? ` by ${request.requesterProfileId}` : ""}.
              </p>
              {request.sourceUrl ? (
                <a href={request.sourceUrl} rel="noreferrer" target="_blank">
                  Open source
                </a>
              ) : null}
            </article>
          ))
        ) : (
          <article className="mini-item-card">
            <div>
              <span>No requests yet</span>
              <strong>This wall has no paste.trade or prediction requests queued</strong>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
