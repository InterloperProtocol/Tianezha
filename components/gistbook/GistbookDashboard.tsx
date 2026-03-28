"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { GistbookRagConsole } from "@/components/gistbook/GistbookRagConsole";
import type {
  GistbookDashboardSnapshot,
  GistbookHeatmapCell,
  GistbookSessionAtlasCard,
  GistbookTerrainPoint,
  GistbookTreemapNode,
} from "@/packages/adapters/src/gistbook";
import type { GistbookProjectMemoryRecord } from "@/lib/server/gistbook-session-intelligence";

interface GistbookDashboardProps {
  dashboard: GistbookDashboardSnapshot;
  projectMemories: GistbookProjectMemoryRecord[];
  generatedAt: string;
  initialProjectId?: string | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toneFromIntensity(intensity: number) {
  const alpha = 0.16 + intensity * 0.72;
  return `rgba(155, 200, 192, ${alpha.toFixed(3)})`;
}

function GistbookTerrainMap({ points }: { points: GistbookTerrainPoint[] }) {
  const tileWidth = 28;
  const tileHeight = 14;
  const heightScale = 42;
  const originX = 170;
  const originY = 268;

  return (
    <svg
      className="gistbook-terrain-svg"
      viewBox="0 0 560 340"
      role="img"
      aria-label="3D terrain map of token usage over time"
    >
      <defs>
        <linearGradient id="gistbook-terrain-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(155, 200, 192, 0.38)" />
          <stop offset="100%" stopColor="rgba(155, 200, 192, 0.08)" />
        </linearGradient>
      </defs>
      {points.map((point) => {
        const isoX = originX + (point.x - point.y) * tileWidth;
        const isoY = originY + (point.x + point.y) * tileHeight * 0.52;
        const lift = point.z * heightScale;
        const top = `${isoX},${isoY - lift} ${isoX + tileWidth},${isoY + tileHeight - lift} ${isoX},${isoY + tileHeight * 2 - lift} ${isoX - tileWidth},${isoY + tileHeight - lift}`;
        const right = `${isoX + tileWidth},${isoY + tileHeight - lift} ${isoX + tileWidth},${isoY + tileHeight} ${isoX},${isoY + tileHeight * 2} ${isoX},${isoY + tileHeight * 2 - lift}`;
        const left = `${isoX - tileWidth},${isoY + tileHeight - lift} ${isoX - tileWidth},${isoY + tileHeight} ${isoX},${isoY + tileHeight * 2} ${isoX},${isoY + tileHeight * 2 - lift}`;
        const fill = toneFromIntensity(point.intensity);

        return (
          <g key={`${point.date}-${point.day}`}>
            <polygon className="gistbook-terrain-face" fill={fill} points={top} />
            <polygon className="gistbook-terrain-wall" fill="url(#gistbook-terrain-side)" points={right} />
            <polygon className="gistbook-terrain-wall gistbook-terrain-wall-left" fill="rgba(155, 200, 192, 0.12)" points={left} />
          </g>
        );
      })}
    </svg>
  );
}

function GistbookHeatmap({ cells }: { cells: GistbookHeatmapCell[] }) {
  return (
    <div className="gistbook-heatmap-grid">
      {cells.map((cell) => (
        <div
          key={cell.date}
          className="gistbook-heatmap-cell"
          style={{ background: toneFromIntensity(cell.intensity) }}
          title={cell.label}
        />
      ))}
    </div>
  );
}

function GistbookTreemap({
  nodes,
  selectedProjectId,
  onSelect,
}: {
  nodes: GistbookTreemapNode[];
  selectedProjectId: string | null;
  onSelect: (projectId: string | null) => void;
}) {
  return (
    <div className="gistbook-treemap">
      {nodes.map((node) => (
        <button
          key={node.id}
          className={selectedProjectId === node.id ? "gistbook-treemap-node is-selected" : "gistbook-treemap-node"}
          onClick={() => onSelect(selectedProjectId === node.id ? null : node.id)}
          style={{
            height: `${node.height}%`,
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: `${node.width}%`,
          }}
          type="button"
        >
          <span>{node.sessionCount} sessions</span>
          <strong>{node.label}</strong>
          <p>{node.tokenEstimate.toLocaleString()} tokens</p>
        </button>
      ))}
    </div>
  );
}

function SessionCardList({ cards }: { cards: GistbookSessionAtlasCard[] }) {
  return (
    <div className="gistbook-card-grid">
      {cards.map((card) => (
        <Link key={card.sessionId} className="gistbook-session-card" href={card.href}>
          <div className="gistbook-session-card-head">
            <div>
              <span>
                {card.projectLabel} | {card.source}
              </span>
              <strong>{card.title}</strong>
            </div>
            <span className="gistbook-session-token">
              {card.tokenEstimate.toLocaleString()} {card.tokenConfidence === "measured" ? "measured" : "est."}
            </span>
          </div>
          <p className="gistbook-session-summary">{card.body}</p>
          <div className="gistbook-session-prompts">
            <article>
              <span>First prompt</span>
              <p>{card.firstPrompt}</p>
            </article>
            <article>
              <span>Last prompt</span>
              <p>{card.lastPrompt}</p>
            </article>
          </div>
          <div className="gistbook-session-card-foot">
            <span>{formatDate(card.updatedAt)}</span>
            <strong>Resume in browser</strong>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function GistbookDashboard({
  dashboard,
  projectMemories,
  generatedAt,
  initialProjectId = null,
}: GistbookDashboardProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);
  const selectedProject = useMemo(
    () => projectMemories.find((memory) => memory.projectId === selectedProjectId) || null,
    [projectMemories, selectedProjectId],
  );

  const filteredCards = useMemo(() => {
    if (!selectedProject) {
      return dashboard.recentCards;
    }

    const sessionIds = new Set(selectedProject.recentSessions.map((session) => session.id));
    const projectCards = dashboard.recentCards.filter((card) => sessionIds.has(card.sessionId));
    return projectCards.length ? projectCards : dashboard.recentCards.filter((card) => card.projectId === selectedProject.projectId);
  }, [dashboard.recentCards, selectedProject]);

  const activeSummary = selectedProject
    ? `${selectedProject.projectLabel} holds ${selectedProject.sessionCount} indexed sessions and ${selectedProject.tokenEstimate.toLocaleString()} tokens of searchable context.`
    : dashboard.summary;

  return (
    <div className="gistbook-shell">
      <section className="panel gistbook-hero">
        <div className="gistbook-hero-copy">
          <p className="eyebrow">Gistbook</p>
          <h1>Vectorless session atlas for Claude Code memory.</h1>
          <p className="route-summary">
            {activeSummary}
          </p>
          <div className="route-badges">
            <span className="status-badge status-badge-success">
              {dashboard.totals.sessions} sessions
            </span>
            <span className="status-badge status-badge-accent">
              {dashboard.totals.projects} projects
            </span>
            <span className="status-badge status-badge-warning">
              {dashboard.totals.days} day window
            </span>
          </div>
          <p className="route-summary compact">
            Built around the same ideas surfaced in the two X references: a vectorless retrieval graph for durable context, and a rich session dashboard with terrain, hover cards, treemaps, heatmaps, and resume routes.
          </p>
        </div>

        <aside className="gistbook-hero-side">
          <div className="gistbook-metric-grid">
            {dashboard.metrics.map((metric) => (
              <article key={metric.label} className="gistbook-metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.note}</p>
              </article>
            ))}
          </div>
          <div className="gistbook-generated-note">
            <span>Indexed at</span>
            <strong>{formatTimestamp(generatedAt)}</strong>
          </div>
        </aside>
      </section>

      <section className="gistbook-grid">
        <section className="panel gistbook-terrain-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Terrain</p>
              <h2>3D token usage over time</h2>
            </div>
          </div>
          <p className="panel-lead">
            Daily token totals are projected into an isometric terrain surface so activity spikes read as ridgelines instead of flat bars.
          </p>
          <div className="gistbook-terrain-stage">
            <GistbookTerrainMap points={dashboard.terrain} />
          </div>
        </section>

        <GistbookRagConsole projectId={selectedProject?.projectId || null} />
      </section>

      <section className="gistbook-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Session cards</p>
              <h2>First and last prompts, hover to expand</h2>
            </div>
          </div>
          <p className="panel-lead">
            {selectedProject
              ? `Showing recent ${selectedProject.projectLabel} sessions.`
              : "Recent sessions across the full atlas. Click any card to resume that thread in-browser."}
          </p>
          <SessionCardList cards={filteredCards.slice(0, 12)} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Treemap</p>
              <h2>Project footprint</h2>
            </div>
          </div>
          <p className="panel-lead">
            Session-heavy projects occupy more space. Click a tile to scope the atlas.
          </p>
          <GistbookTreemap
            nodes={dashboard.treemap}
            onSelect={setSelectedProjectId}
            selectedProjectId={selectedProjectId}
          />
        </section>
      </section>

      <section className="gistbook-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Heatmap</p>
              <h2>Activity over the last three months</h2>
            </div>
          </div>
          <p className="panel-lead">
            The flat heatmap complements the terrain view with a denser day-by-day read.
          </p>
          <GistbookHeatmap cells={dashboard.heatmap} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Project memory</p>
              <h2>Thought cards, interface plans, and change cards</h2>
            </div>
          </div>
          <div className="gistbook-memory-list">
            {(selectedProject ? [selectedProject] : projectMemories.slice(0, 4)).map((memory) => (
              <article key={memory.projectId} className="gistbook-memory-card">
                <div>
                  <span>
                    {memory.sessionCount} sessions | {memory.tokenEstimate.toLocaleString()} tokens
                  </span>
                  <strong>{memory.projectLabel}</strong>
                </div>
                <p>{memory.notes[0]?.body}</p>
                <div className="gistbook-memory-tags">
                  {memory.keywords.slice(0, 6).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
