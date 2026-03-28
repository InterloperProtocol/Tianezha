import type { CapabilityAd } from "@/packages/core/src/protocol";

export interface GistbookCard {
  id: string;
  kind: "note" | "thought_card" | "interface_plan" | "change_card";
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
}

export type GistbookSessionSource = "claude" | "codex";
export type GistbookTokenConfidence = "measured" | "estimated";

export interface GistbookSessionAtlasCard extends GistbookCard {
  sessionId: string;
  projectId: string;
  projectLabel: string;
  firstPrompt: string;
  lastPrompt: string;
  startedAt: string;
  updatedAt: string;
  href: string;
  source: GistbookSessionSource;
  tokenEstimate: number;
  tokenConfidence: GistbookTokenConfidence;
}

export interface GistbookHeatmapCell {
  date: string;
  label: string;
  day: number;
  week: number;
  sessions: number;
  tokens: number;
  intensity: number;
}

export interface GistbookTerrainPoint {
  date: string;
  label: string;
  week: number;
  day: number;
  sessions: number;
  tokens: number;
  intensity: number;
  x: number;
  y: number;
  z: number;
}

export interface GistbookTreemapNode {
  id: string;
  label: string;
  value: number;
  sessionCount: number;
  tokenEstimate: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GistbookDashboardSnapshot {
  title: string;
  summary: string;
  totals: {
    sessions: number;
    projects: number;
    days: number;
    tokenEstimate: number;
  };
  metrics: Array<{
    label: string;
    value: string;
    note: string;
  }>;
  recentCards: GistbookSessionAtlasCard[];
  heatmap: GistbookHeatmapCell[];
  terrain: GistbookTerrainPoint[];
  treemap: GistbookTreemapNode[];
}

export interface GistbookRagSource {
  id: string;
  title: string;
  summary: string;
  score: number;
  sessionId: string;
  projectLabel: string;
  href: string;
}

export interface GistbookRagAnswer {
  answer: string;
  mode: "vectorless_pageindex";
  query: string;
  path: Array<{
    title: string;
    summary: string;
    score: number;
  }>;
  sources: GistbookRagSource[];
}

export interface GistbookProjectMemory {
  id: string;
  nodeId: string;
  projectLabel: string;
  notes: GistbookCard[];
  interfacePlans: GistbookCard[];
  thoughtCards: GistbookCard[];
  changeCards: GistbookCard[];
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

function createCard(
  kind: GistbookCard["kind"],
  title: string,
  body: string,
  tags: string[],
): GistbookCard {
  return {
    body,
    createdAt: nowIso(),
    id: `gistbook:${kind}:${title.toLowerCase().replace(/\s+/g, "-")}`,
    kind,
    tags,
    title,
  };
}

export function saveNote(title: string, body: string, tags: string[] = []) {
  return createCard("note", title, body, tags);
}

export function publishThoughtCard(title: string, body: string, tags: string[] = []) {
  return createCard("thought_card", title, body, tags);
}

export function exportInterfacePlan(title: string, body: string, tags: string[] = []) {
  return createCard("interface_plan", title, body, tags);
}

export function createChangeCard(title: string, body: string, tags: string[] = []) {
  return createCard("change_card", title, body, tags);
}

export function attachProjectMemory(args: {
  nodeId: string;
  projectLabel: string;
  notes?: GistbookCard[];
  interfacePlans?: GistbookCard[];
  thoughtCards?: GistbookCard[];
  changeCards?: GistbookCard[];
}): GistbookProjectMemory {
  return {
    changeCards: args.changeCards ?? [],
    id: `gistbook-memory:${args.nodeId}`,
    interfacePlans: args.interfacePlans ?? [],
    nodeId: args.nodeId,
    notes: args.notes ?? [],
    projectLabel: args.projectLabel,
    thoughtCards: args.thoughtCards ?? [],
    updatedAt: nowIso(),
  };
}

export function createSessionAtlasCard(args: {
  sessionId: string;
  projectId: string;
  projectLabel: string;
  title: string;
  body: string;
  tags?: string[];
  firstPrompt: string;
  lastPrompt: string;
  startedAt: string;
  updatedAt: string;
  href: string;
  source: GistbookSessionSource;
  tokenEstimate: number;
  tokenConfidence: GistbookTokenConfidence;
}): GistbookSessionAtlasCard {
  return {
    ...createCard("thought_card", args.title, args.body, args.tags ?? []),
    firstPrompt: args.firstPrompt,
    href: args.href,
    lastPrompt: args.lastPrompt,
    projectId: args.projectId,
    projectLabel: args.projectLabel,
    sessionId: args.sessionId,
    source: args.source,
    startedAt: args.startedAt,
    tokenConfidence: args.tokenConfidence,
    tokenEstimate: args.tokenEstimate,
    updatedAt: args.updatedAt,
  };
}

export function buildGistbookCapabilityAd(args: {
  id: string;
  peerId: string;
  actorId: string;
}): CapabilityAd {
  const timestamp = nowIso();
  return {
    actorId: args.actorId,
    capability: "gistbook_memory",
    createdAt: timestamp,
    id: args.id,
    latencyMs: 25,
    peerId: args.peerId,
    priceHint: 0,
    region: "local",
    reliabilityScore: 0.99,
    settlementAdapters: ["manual_invoice"],
    tier: "core",
    updatedAt: timestamp,
  };
}
