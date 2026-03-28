import Link from "next/link";
import { notFound } from "next/navigation";

import { GistbookRagConsole } from "@/components/gistbook/GistbookRagConsole";
import { TianezhaScaffold } from "@/components/shell/TianezhaScaffold";
import { getGistbookSessionDetail } from "@/lib/server/gistbook-session-intelligence";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    sessionId: string;
  }>;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function GistbookSessionPage({ params }: Props) {
  const { sessionId } = await params;
  const detail = getGistbookSessionDetail(decodeURIComponent(sessionId));

  if (!detail) {
    notFound();
  }

  const { relatedProjectMemory, session, tree } = detail;

  return (
    <TianezhaScaffold>
      <section className="panel gistbook-session-hero">
        <div className="gistbook-session-copy">
          <p className="eyebrow">Gistbook Session</p>
          <h1>{session.title}</h1>
          <p className="route-summary">
            {session.summary}
          </p>
          <div className="route-badges">
            <span className="status-badge status-badge-accent">{session.projectLabel}</span>
            <span className="status-badge status-badge-success">{session.source}</span>
            <span className="status-badge status-badge-warning">
              {session.tokenEstimate.toLocaleString()} tokens
            </span>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/gistbook">
              Back to atlas
            </Link>
            <Link className="button button-primary" href={`/gistbook?project=${encodeURIComponent(session.projectId)}`}>
              Open project memory
            </Link>
          </div>
        </div>

        <aside className="gistbook-session-rail">
          <article className="mini-item-card">
            <div>
              <span>Started</span>
              <strong>{formatTimestamp(session.startedAt)}</strong>
            </div>
            <p className="route-summary compact">
              Updated {formatTimestamp(session.updatedAt)} across {session.durationMinutes} minutes.
            </p>
          </article>
          <article className="mini-item-card">
            <div>
              <span>First prompt</span>
              <strong>{session.firstPrompt}</strong>
            </div>
          </article>
          <article className="mini-item-card">
            <div>
              <span>Last prompt</span>
              <strong>{session.lastPrompt}</strong>
            </div>
          </article>
        </aside>
      </section>

      <section className="gistbook-grid">
        <GistbookRagConsole
          lead="Query just this session. The vectorless route walks the session tree from chapter summaries down to transcript leaves."
          sessionId={session.id}
          title="Session PageIndex console"
        />

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">PageIndex</p>
              <h2>Hierarchical retrieval map</h2>
            </div>
          </div>
          <div className="gistbook-memory-list">
            <article className="gistbook-memory-card">
              <div>
                <span>Root summary</span>
                <strong>{tree.root.title}</strong>
              </div>
              <p>{tree.root.summary}</p>
            </article>
            {tree.root.children.slice(0, 6).map((child) => (
              <article key={child.id} className="gistbook-memory-card">
                <div>
                  <span>Depth {child.depth}</span>
                  <strong>{child.title}</strong>
                </div>
                <p>{child.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="gistbook-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Transcript</p>
              <h2>Full in-browser resume view</h2>
            </div>
          </div>
          <div className="gistbook-transcript">
            {session.messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "user"
                    ? "gistbook-transcript-message is-user"
                    : "gistbook-transcript-message"
                }
              >
                <div>
                  <span>
                    {message.role}
                    {message.phase ? ` | ${message.phase}` : ""}
                  </span>
                  <strong>{formatTimestamp(message.createdAt)}</strong>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Project memory</p>
              <h2>Nearby context from the same project</h2>
            </div>
          </div>
          {relatedProjectMemory ? (
            <div className="gistbook-memory-list">
              <article className="gistbook-memory-card">
                <div>
                  <span>{relatedProjectMemory.sessionCount} sessions</span>
                  <strong>{relatedProjectMemory.projectLabel}</strong>
                </div>
                <p>{relatedProjectMemory.notes[0]?.body}</p>
              </article>
              {relatedProjectMemory.recentSessions
                .filter((entry) => entry.id !== session.id)
                .slice(0, 5)
                .map((entry) => (
                  <Link key={entry.id} className="gistbook-memory-card" href={entry.resumeHref}>
                    <div>
                      <span>{entry.source}</span>
                      <strong>{entry.title}</strong>
                    </div>
                    <p>{entry.summary}</p>
                  </Link>
                ))}
            </div>
          ) : (
            <p className="empty-state">No related project memory was reconstructed for this session.</p>
          )}
        </section>
      </section>
    </TianezhaScaffold>
  );
}
