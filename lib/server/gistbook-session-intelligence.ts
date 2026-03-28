import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

import {
  attachProjectMemory,
  createChangeCard,
  createSessionAtlasCard,
  exportInterfacePlan,
  GistbookDashboardSnapshot,
  GistbookProjectMemory,
  GistbookRagAnswer,
  GistbookSessionAtlasCard,
  GistbookTokenConfidence,
  publishThoughtCard,
  saveNote,
} from "@/packages/adapters/src/gistbook";
import {
  buildPageIndexTree,
  PageIndexTree,
  queryPageIndexTree,
} from "@/packages/core/src/pageindexRag";

const ATLAS_CACHE_TTL_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

export interface GistbookSessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  phase?: string | null;
}

export interface GistbookSessionRecord {
  id: string;
  source: "claude" | "codex";
  title: string;
  threadName: string | null;
  projectId: string;
  projectLabel: string;
  cwd: string | null;
  rawPath: string;
  firstPrompt: string;
  lastPrompt: string;
  summary: string;
  keywords: string[];
  messages: GistbookSessionMessage[];
  startedAt: string;
  updatedAt: string;
  durationMinutes: number;
  tokenEstimate: number;
  tokenConfidence: GistbookTokenConfidence;
  resumeHref: string;
}

export interface GistbookProjectMemoryRecord extends GistbookProjectMemory {
  projectId: string;
  sessionCount: number;
  tokenEstimate: number;
  keywords: string[];
  recentSessions: GistbookSessionRecord[];
}

export interface GistbookSessionDetail {
  session: GistbookSessionRecord;
  sessionCard: GistbookSessionAtlasCard;
  tree: PageIndexTree;
  relatedProjectMemory: GistbookProjectMemoryRecord | null;
}

interface AtlasOptions {
  claudeRoot?: string;
  codexRoot?: string;
  now?: Date;
}

interface AtlasState {
  generatedAt: string;
  sessions: GistbookSessionRecord[];
  cards: GistbookSessionAtlasCard[];
  dashboard: GistbookDashboardSnapshot;
  projectMemories: GistbookProjectMemoryRecord[];
  ragCorpus: Array<{
    id: string;
    kind: "session" | "project";
    sessionId: string | null;
    projectId: string;
    projectLabel: string;
    href: string;
    title: string;
    tree: PageIndexTree;
  }>;
}

const atlasCache = new Map<
  string,
  {
    expiresAt: number;
    value: AtlasState;
  }
>();

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "build",
  "by",
  "for",
  "from",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "make",
  "of",
  "on",
  "or",
  "please",
  "that",
  "the",
  "this",
  "to",
  "use",
  "was",
  "we",
  "with",
  "you",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function hashId(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readJsonLines(filePath: string) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => safeJsonParse<JsonRecord>(line))
    .filter((value): value is JsonRecord => Boolean(value));
}

function collectFiles(root: string, predicate: (filePath: string) => boolean) {
  if (!existsSync(root)) {
    return [];
  }

  const results: string[] = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (predicate(fullPath)) {
        results.push(fullPath);
      }
    });
  }

  return results;
}

function resolveRoots(options: AtlasOptions) {
  const home = homedir();
  return {
    claudeRoot:
      options.claudeRoot ||
      process.env.GISTBOOK_CLAUDE_ROOT ||
      path.join(home, ".claude"),
    codexRoot:
      options.codexRoot ||
      process.env.GISTBOOK_CODEX_ROOT ||
      path.join(home, ".codex"),
  };
}

function buildCacheKey(options: AtlasOptions) {
  const roots = resolveRoots(options);
  return `${roots.claudeRoot}::${roots.codexRoot}`;
}

function extractTextChunks(content: unknown): string[] {
  if (!content) {
    return [];
  }
  if (typeof content === "string") {
    return [content];
  }
  if (!Array.isArray(content)) {
    return [];
  }

  return content
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        if (typeof record.text === "string") {
          return record.text;
        }
      }
      return "";
    })
    .filter(Boolean);
}

function summarizeText(value: string, limit = 180) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 3).trimEnd()}...`;
}

function tokenize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function topKeywords(values: string[], limit = 8) {
  const counts = new Map<string, number>();
  values
    .flatMap((value) => tokenize(value))
    .forEach((term) => {
      counts.set(term, (counts.get(term) || 0) + 1);
    });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function estimateTokens(values: string[]) {
  const characters = values.reduce((total, value) => total + normalizeWhitespace(value).length, 0);
  return Math.max(0, Math.ceil(characters / 4));
}

function coerceTimestamp(value: unknown, fallback = new Date(0).toISOString()) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
}

function durationMinutes(startedAt: string, updatedAt: string) {
  const start = new Date(startedAt).getTime();
  const end = new Date(updatedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return Math.round((end - start) / 60_000);
}

function promptCandidate(value: string) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length < 20) {
    return false;
  }
  if (normalized.startsWith("# AGENTS.md instructions")) {
    return false;
  }
  if (normalized.startsWith("<environment_context>")) {
    return false;
  }
  if (normalized.startsWith("## Skills")) {
    return false;
  }
  if (normalized === "[Request interrupted by user]") {
    return false;
  }
  return true;
}

function buildSessionTitle(threadName: string | null, firstPrompt: string, fallback: string) {
  if (threadName && threadName.trim()) {
    return threadName.trim();
  }

  if (firstPrompt) {
    return summarizeText(firstPrompt.replace(/\n/g, " "), 72);
  }

  return fallback;
}

function buildSessionSummary(
  title: string,
  firstPrompt: string,
  lastPrompt: string,
  keywords: string[],
) {
  const first = summarizeText(firstPrompt, 120);
  const last = summarizeText(lastPrompt, 120);
  return normalizeWhitespace(
    `${title}. First prompt: ${first || "n/a"}. Last prompt: ${last || "n/a"}. ` +
      `${keywords.length ? `Themes: ${keywords.join(", ")}.` : ""}`,
  );
}

function inferProjectLabel(cwd: string | null, filePath: string) {
  if (cwd) {
    const normalized = cwd.replace(/[\\/]+$/, "");
    const label = path.basename(normalized);
    return label || normalized;
  }

  return path.basename(path.dirname(filePath));
}

function buildProjectId(cwd: string | null, label: string) {
  const basis = cwd || label;
  return `${slugify(label || "project")}-${hashId(basis)}`;
}

function buildResumeHref(sessionId: string) {
  return `/gistbook/session/${encodeURIComponent(sessionId)}`;
}

function parseClaudeSessions(claudeRoot: string): GistbookSessionRecord[] {
  const files = collectFiles(path.join(claudeRoot, "projects"), (filePath) => {
    return filePath.endsWith(".jsonl") && !filePath.includes(`${path.sep}subagents${path.sep}`);
  });

  return files
    .map((filePath): GistbookSessionRecord | null => {
      const records = readJsonLines(filePath);
      const messages: GistbookSessionMessage[] = [];
      const promptTexts: string[] = [];
      let sessionId = path.basename(filePath, path.extname(filePath));
      let cwd: string | null = null;
      let startedAt = "";
      let updatedAt = "";

      records.forEach((record, index) => {
        const rawCwd = typeof record.cwd === "string" ? record.cwd : null;
        if (rawCwd && !cwd) {
          cwd = rawCwd;
        }

        const timestamp = coerceTimestamp(record.timestamp, new Date(0).toISOString());
        if (!startedAt || timestamp < startedAt) {
          startedAt = timestamp;
        }
        if (!updatedAt || timestamp > updatedAt) {
          updatedAt = timestamp;
        }

        if (typeof record.sessionId === "string" && record.sessionId) {
          sessionId = record.sessionId;
        }

        const role =
          record.type === "user"
            ? "user"
            : record.type === "assistant"
              ? "assistant"
              : null;
        const messageRecord =
          record.message && typeof record.message === "object"
            ? (record.message as Record<string, unknown>)
            : null;
        const text = normalizeWhitespace(extractTextChunks(messageRecord?.content).join("\n\n"));

        if (!role || !text) {
          return;
        }

        messages.push({
          createdAt: timestamp,
          id: `${sessionId}:${index}`,
          role,
          text,
        });

        if (role === "user" && promptCandidate(text)) {
          promptTexts.push(text);
        }
      });

      if (!messages.length) {
        return null;
      }

      const firstPrompt = promptTexts[0] || messages.find((message) => message.role === "user")?.text || "";
      const lastPrompt =
        promptTexts[promptTexts.length - 1] ||
        [...messages].reverse().find((message) => message.role === "user")?.text ||
        "";
      const projectLabel = inferProjectLabel(cwd, filePath);
      const projectId = buildProjectId(cwd, projectLabel);
      const keywords = topKeywords([firstPrompt, lastPrompt, ...messages.map((message) => message.text)], 8);
      const title = buildSessionTitle(null, firstPrompt, projectLabel);

      return {
        cwd,
        durationMinutes: durationMinutes(startedAt, updatedAt),
        firstPrompt: summarizeText(firstPrompt, 220),
        id: sessionId,
        keywords,
        lastPrompt: summarizeText(lastPrompt, 220),
        messages,
        projectId,
        projectLabel,
        rawPath: filePath,
        resumeHref: buildResumeHref(sessionId),
        source: "claude" as const,
        startedAt,
        summary: buildSessionSummary(title, firstPrompt, lastPrompt, keywords),
        threadName: null,
        title,
        tokenConfidence: "estimated" as const,
        tokenEstimate: estimateTokens(messages.map((message) => message.text)),
        updatedAt,
      } satisfies GistbookSessionRecord;
    })
    .filter((session): session is GistbookSessionRecord => Boolean(session))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function parseCodexIndex(codexRoot: string) {
  const filePath = path.join(codexRoot, "session_index.jsonl");
  if (!existsSync(filePath)) {
    return new Map<string, { threadName: string; updatedAt: string }>();
  }

  return new Map(
    readJsonLines(filePath)
      .map((record) => {
        if (typeof record.id !== "string" || typeof record.thread_name !== "string") {
          return null;
        }

        return [
          record.id,
          {
            threadName: record.thread_name,
            updatedAt: coerceTimestamp(record.updated_at, new Date(0).toISOString()),
          },
        ] as const;
      })
      .filter((entry): entry is readonly [string, { threadName: string; updatedAt: string }] => Boolean(entry)),
  );
}

function parseCodexSessions(codexRoot: string): GistbookSessionRecord[] {
  const indexMap = parseCodexIndex(codexRoot);
  const files = collectFiles(path.join(codexRoot, "sessions"), (filePath) => filePath.endsWith(".jsonl"));

  return files
    .map((filePath): GistbookSessionRecord | null => {
      const records = readJsonLines(filePath);
      const messages: GistbookSessionMessage[] = [];
      const promptTexts: string[] = [];
      let sessionId = path.basename(filePath, path.extname(filePath));
      let cwd: string | null = null;
      let startedAt = "";
      let updatedAt = "";
      let threadName: string | null = null;
      let measuredTokens = 0;

      records.forEach((record, index) => {
        const timestamp = coerceTimestamp(record.timestamp, new Date(0).toISOString());
        if (!startedAt || timestamp < startedAt) {
          startedAt = timestamp;
        }
        if (!updatedAt || timestamp > updatedAt) {
          updatedAt = timestamp;
        }

        if (record.type === "session_meta" && record.payload && typeof record.payload === "object") {
          const payload = record.payload as Record<string, unknown>;
          if (typeof payload.id === "string") {
            sessionId = payload.id;
          }
          if (typeof payload.cwd === "string" && !cwd) {
            cwd = payload.cwd;
          }
          if (typeof payload.timestamp === "string" && (!startedAt || payload.timestamp < startedAt)) {
            startedAt = coerceTimestamp(payload.timestamp, startedAt);
          }
        }

        if (record.type === "event_msg" && record.payload && typeof record.payload === "object") {
          const payload = record.payload as Record<string, unknown>;
          if (payload.type === "token_count" && payload.info && typeof payload.info === "object") {
            const info = payload.info as Record<string, unknown>;
            const lastUsage =
              info.last_token_usage && typeof info.last_token_usage === "object"
                ? (info.last_token_usage as Record<string, unknown>)
                : null;
            if (lastUsage && typeof lastUsage.total_tokens === "number") {
              measuredTokens += lastUsage.total_tokens;
            }
          }
        }

        if (record.type !== "response_item" || !record.payload || typeof record.payload !== "object") {
          return;
        }

        const payload = record.payload as Record<string, unknown>;
        if (payload.type !== "message") {
          return;
        }

        const role =
          payload.role === "user"
            ? "user"
            : payload.role === "assistant"
              ? "assistant"
              : null;
        const text = normalizeWhitespace(extractTextChunks(payload.content).join("\n\n"));
        if (!role || !text) {
          return;
        }

        const phase = typeof payload.phase === "string" ? payload.phase : null;
        messages.push({
          createdAt: timestamp,
          id: `${sessionId}:${index}`,
          phase,
          role,
          text,
        });

        if (role === "user" && promptCandidate(text)) {
          promptTexts.push(text);
        }
      });

      if (!messages.length) {
        return null;
      }

      const indexRecord = indexMap.get(sessionId);
      threadName = indexRecord?.threadName || null;
      updatedAt = indexRecord?.updatedAt || updatedAt;

      const firstPrompt = promptTexts[0] || messages.find((message) => message.role === "user")?.text || "";
      const lastPrompt =
        promptTexts[promptTexts.length - 1] ||
        [...messages].reverse().find((message) => message.role === "user")?.text ||
        "";
      const projectLabel = inferProjectLabel(cwd, filePath);
      const projectId = buildProjectId(cwd, projectLabel);
      const keywords = topKeywords([threadName || "", firstPrompt, lastPrompt, ...messages.map((message) => message.text)], 8);
      const title = buildSessionTitle(threadName, firstPrompt, projectLabel);
      const estimatedTokens = estimateTokens(messages.map((message) => message.text));

      return {
        cwd,
        durationMinutes: durationMinutes(startedAt, updatedAt),
        firstPrompt: summarizeText(firstPrompt, 220),
        id: sessionId,
        keywords,
        lastPrompt: summarizeText(lastPrompt, 220),
        messages,
        projectId,
        projectLabel,
        rawPath: filePath,
        resumeHref: buildResumeHref(sessionId),
        source: "codex" as const,
        startedAt,
        summary: buildSessionSummary(title, firstPrompt, lastPrompt, keywords),
        threadName,
        title,
        tokenConfidence: measuredTokens > 0 ? "measured" : "estimated",
        tokenEstimate: measuredTokens || estimatedTokens,
        updatedAt,
      } satisfies GistbookSessionRecord;
    })
    .filter((session): session is GistbookSessionRecord => Boolean(session))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function buildAtlasCards(sessions: GistbookSessionRecord[]) {
  return sessions.map((session) =>
    createSessionAtlasCard({
      body: session.summary,
      firstPrompt: session.firstPrompt,
      href: session.resumeHref,
      lastPrompt: session.lastPrompt,
      projectId: session.projectId,
      projectLabel: session.projectLabel,
      sessionId: session.id,
      source: session.source,
      startedAt: session.startedAt,
      tags: session.keywords.slice(0, 5),
      title: session.title,
      tokenConfidence: session.tokenConfidence,
      tokenEstimate: session.tokenEstimate,
      updatedAt: session.updatedAt,
    }),
  );
}

function buildProjectMemories(sessions: GistbookSessionRecord[]) {
  const grouped = new Map<string, GistbookSessionRecord[]>();
  sessions.forEach((session) => {
    const current = grouped.get(session.projectId) || [];
    current.push(session);
    grouped.set(session.projectId, current);
  });

  return Array.from(grouped.entries())
    .map(([projectId, projectSessions]) => {
      const ordered = projectSessions
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const latest = ordered[0];
      const keywords = topKeywords(
        ordered.flatMap((session) => [session.firstPrompt, session.lastPrompt, ...session.messages.map((message) => message.text)]),
        10,
      );
      const tokenEstimate = ordered.reduce((total, session) => total + session.tokenEstimate, 0);
      const notes = [
        saveNote(
          `${latest.projectLabel} memory`,
          `${latest.projectLabel} has ${ordered.length} indexed sessions and ${tokenEstimate.toLocaleString()} tokens of recoverable context. Themes: ${keywords.slice(0, 6).join(", ")}.`,
          keywords.slice(0, 6),
        ),
      ];
      const thoughtCards = ordered.slice(0, 3).map((session) =>
        publishThoughtCard(
          session.title,
          `${session.summary} Resume path: ${session.resumeHref}.`,
          session.keywords.slice(0, 5),
        ),
      );
      const changeCards = ordered.slice(0, 2).map((session) =>
        createChangeCard(
          `${session.projectLabel} latest move`,
          `Last prompt: ${session.lastPrompt}`,
          session.keywords.slice(0, 4),
        ),
      );
      const interfacePlans = ordered
        .filter((session) => /dashboard|ui|interface|layout|panel|page/i.test(session.summary))
        .slice(0, 2)
        .map((session) =>
          exportInterfacePlan(
            `${session.projectLabel} interface track`,
            `${session.title}. ${session.summary}`,
            session.keywords.slice(0, 5),
          ),
        );

      return {
        ...attachProjectMemory({
          changeCards,
          interfacePlans,
          nodeId: projectId,
          notes,
          projectLabel: latest.projectLabel,
          thoughtCards,
        }),
        keywords,
        projectId,
        recentSessions: ordered.slice(0, 6),
        sessionCount: ordered.length,
        tokenEstimate,
      } satisfies GistbookProjectMemoryRecord;
    })
    .sort((left, right) => right.sessionCount - left.sessionCount || right.updatedAt.localeCompare(left.updatedAt));
}

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function isoDay(value: Date) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function buildDailyTimeline(sessions: GistbookSessionRecord[], now: Date) {
  const end = startOfDay(now);
  const start = new Date(end.getTime() - 90 * DAY_MS);
  const dayStats = new Map<string, { sessions: number; tokens: number }>();

  sessions.forEach((session) => {
    const key = isoDay(new Date(session.updatedAt));
    const current = dayStats.get(key) || { sessions: 0, tokens: 0 };
    current.sessions += 1;
    current.tokens += session.tokenEstimate;
    dayStats.set(key, current);
  });

  const cells = [];
  for (let index = 0; index <= 90; index += 1) {
    const currentDay = new Date(start.getTime() + index * DAY_MS);
    const key = isoDay(currentDay);
    const stats = dayStats.get(key) || { sessions: 0, tokens: 0 };
    cells.push({
      date: key,
      day: currentDay.getUTCDay(),
      sessions: stats.sessions,
      tokens: stats.tokens,
      week: Math.floor(index / 7),
    });
  }

  const maxTokens = Math.max(1, ...cells.map((cell) => cell.tokens));
  return cells.map((cell) => ({
    ...cell,
    intensity: clamp(cell.tokens / maxTokens, 0, 1),
    label: `${cell.date} | ${cell.sessions} sessions | ${cell.tokens.toLocaleString()} tokens`,
  }));
}

function buildTerrain(cells: ReturnType<typeof buildDailyTimeline>) {
  return cells.map((cell) => ({
    ...cell,
    x: cell.week,
    y: cell.day,
    z: Number((cell.intensity * 1.8 + cell.sessions * 0.08).toFixed(4)),
  }));
}

function buildTreemap(projectMemories: GistbookProjectMemoryRecord[]) {
  const nodes = projectMemories
    .slice(0, 10)
    .map((memory) => ({
      id: memory.projectId,
      label: memory.projectLabel,
      sessionCount: memory.sessionCount,
      tokenEstimate: memory.tokenEstimate,
      value: Math.max(memory.tokenEstimate, memory.sessionCount * 600),
    }));

  const total = nodes.reduce((sum, node) => sum + node.value, 0) || 1;
  let cursor = 0;

  return nodes.map((node, index) => {
    const ratio = node.value / total;
    if (index % 2 === 0) {
      const width = ratio * 100;
      const result = {
        ...node,
        height: 54,
        width,
        x: cursor,
        y: 0,
      };
      cursor += width;
      return result;
    }

    const width = ratio * 100;
    const result = {
      ...node,
      height: 46,
      width,
      x: cursor,
      y: 54,
    };
    cursor += width;
    return result;
  });
}

function buildDashboard(
  sessions: GistbookSessionRecord[],
  cards: GistbookSessionAtlasCard[],
  projectMemories: GistbookProjectMemoryRecord[],
  now: Date,
) {
  const timeline = buildDailyTimeline(sessions, now);
  const oldest = sessions[sessions.length - 1];
  const newest = sessions[0];
  const totalTokens = sessions.reduce((total, session) => total + session.tokenEstimate, 0);
  const totalDays =
    oldest && newest
      ? Math.max(
          1,
          Math.round(
            (new Date(newest.updatedAt).getTime() - new Date(oldest.startedAt).getTime()) / DAY_MS,
          ) + 1,
        )
      : 0;

  return {
    heatmap: timeline,
    metrics: [
      {
        label: "Session density",
        note: "Across local Claude and Codex histories",
        value: `${sessions.length} sessions`,
      },
      {
        label: "Project spread",
        note: "Unique working directories recovered from logs",
        value: `${projectMemories.length} projects`,
      },
      {
        label: "Token surface",
        note: "Measured when available, estimated otherwise",
        value: `${totalTokens.toLocaleString()} tokens`,
      },
      {
        label: "Time window",
        note: "Approximate active span across the indexed archive",
        value: `${totalDays} days`,
      },
    ],
    recentCards: cards.slice(0, 18),
    summary:
      "Gistbook now runs a vectorless session atlas on top of local Claude and Codex histories. The dashboard uses topographic token terrain, hoverable session cards, project treemaps, activity heatmaps, and in-browser resume routes instead of a hidden vector store.",
    terrain: buildTerrain(timeline),
    title: "Gistbook Session Atlas",
    totals: {
      days: totalDays,
      projects: projectMemories.length,
      sessions: sessions.length,
      tokenEstimate: totalTokens,
    },
    treemap: buildTreemap(projectMemories),
  } satisfies GistbookDashboardSnapshot;
}

function sessionToDocument(session: GistbookSessionRecord) {
  const turns = session.messages
    .map((message, index) => {
      const when = new Date(message.createdAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      return `## ${message.role.toUpperCase()} ${index + 1} | ${when}\n\n${message.text}`;
    })
    .join("\n\n");

  return {
    body: [
      `# ${session.title}`,
      "",
      `Project: ${session.projectLabel}`,
      `Source: ${session.source}`,
      `Summary: ${session.summary}`,
      "",
      turns,
    ].join("\n"),
    href: session.resumeHref,
    id: `session:${session.id}`,
    kind: "session" as const,
    projectId: session.projectId,
    projectLabel: session.projectLabel,
    sessionId: session.id,
    title: session.title,
  };
}

function projectMemoryToDocument(memory: GistbookProjectMemoryRecord) {
  const cards = [
    ...memory.notes,
    ...memory.thoughtCards,
    ...memory.interfacePlans,
    ...memory.changeCards,
  ]
    .map((card) => `## ${card.kind}\n\n${card.title}\n\n${card.body}`)
    .join("\n\n");

  return {
    body: [
      `# ${memory.projectLabel} project memory`,
      "",
      `Sessions: ${memory.sessionCount}`,
      `Tokens: ${memory.tokenEstimate}`,
      `Themes: ${memory.keywords.join(", ")}`,
      "",
      cards,
    ].join("\n"),
    href: `/gistbook?project=${encodeURIComponent(memory.projectId)}`,
    id: `project:${memory.projectId}`,
    kind: "project" as const,
    projectId: memory.projectId,
    projectLabel: memory.projectLabel,
    sessionId: null,
    title: `${memory.projectLabel} project memory`,
  };
}

function buildRagCorpus(
  sessions: GistbookSessionRecord[],
  projectMemories: GistbookProjectMemoryRecord[],
) {
  const sessionDocs = sessions.map(sessionToDocument);
  const projectDocs = projectMemories.map(projectMemoryToDocument);

  return [...projectDocs, ...sessionDocs].map((document) => ({
    ...document,
    tree: buildPageIndexTree({
      body: document.body,
      id: document.id,
      title: document.title,
    }),
  }));
}

function buildAtlas(options: AtlasOptions): AtlasState {
  const now = options.now || new Date();
  const roots = resolveRoots(options);
  const sessions = unique(
    [...parseCodexSessions(roots.codexRoot), ...parseClaudeSessions(roots.claudeRoot)].sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt),
    ),
  ).slice();
  const cards = buildAtlasCards(sessions);
  const projectMemories = buildProjectMemories(sessions);
  const dashboard = buildDashboard(sessions, cards, projectMemories, now);

  return {
    cards,
    dashboard,
    generatedAt: now.toISOString(),
    projectMemories,
    ragCorpus: buildRagCorpus(sessions, projectMemories),
    sessions,
  };
}

function getAtlas(options: AtlasOptions = {}) {
  const key = buildCacheKey(options);
  const cached = atlasCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = buildAtlas(options);
  atlasCache.set(key, {
    expiresAt: Date.now() + ATLAS_CACHE_TTL_MS,
    value,
  });
  return value;
}

export function getGistbookDashboard(options: AtlasOptions = {}) {
  const atlas = getAtlas(options);
  return {
    dashboard: atlas.dashboard,
    generatedAt: atlas.generatedAt,
    projectMemories: atlas.projectMemories,
  };
}

export function listGistbookSessions(options: AtlasOptions = {}) {
  return getAtlas(options).sessions;
}

export function getGistbookSessionDetail(
  sessionId: string,
  options: AtlasOptions = {},
): GistbookSessionDetail | null {
  const atlas = getAtlas(options);
  const session = atlas.sessions.find((entry) => entry.id === sessionId);
  if (!session) {
    return null;
  }

  return {
    relatedProjectMemory:
      atlas.projectMemories.find((memory) => memory.projectId === session.projectId) || null,
    session,
    sessionCard: atlas.cards.find((card) => card.sessionId === sessionId)!,
    tree: atlas.ragCorpus.find((entry) => entry.kind === "session" && entry.sessionId === sessionId)!.tree,
  };
}

export function queryGistbookRag(
  query: string,
  options: AtlasOptions & {
    projectId?: string | null;
    sessionId?: string | null;
  } = {},
): GistbookRagAnswer {
  const normalizedQuery = normalizeWhitespace(query);
  const atlas = getAtlas(options);
  const scopedCorpus = atlas.ragCorpus.filter((entry) => {
    if (options.sessionId) {
      return entry.sessionId === options.sessionId;
    }
    if (options.projectId) {
      return entry.projectId === options.projectId;
    }
    return true;
  });

  const scored = scopedCorpus
    .map((entry) => {
      const result = queryPageIndexTree(entry.tree, normalizedQuery, 2);
      const bestScore = result.matches[0]?.score || 0;
      return {
        bestScore,
        entry,
        result,
      };
    })
    .sort((left, right) => right.bestScore - left.bestScore || left.entry.title.localeCompare(right.entry.title))
    .slice(0, 3);

  if (!scored.length || scored[0].bestScore <= 0) {
    return {
      answer: `No strong match was found for "${normalizedQuery}" in the current Gistbook scope.`,
      mode: "vectorless_pageindex",
      path: [],
      query: normalizedQuery,
      sources: [],
    };
  }

  const best = scored[0];
  const supportingAnswers = scored
    .map(({ entry, result }) => `${entry.title}: ${result.answer}`)
    .slice(0, 2)
    .join(" ");

  return {
    answer: normalizeWhitespace(supportingAnswers),
    mode: "vectorless_pageindex",
    path: best.result.path.map((step) => ({
      score: step.score,
      summary: step.summary,
      title: step.title,
    })),
    query: normalizedQuery,
    sources: scored.flatMap(({ entry, result }) =>
      result.matches.slice(0, 2).map((match) => ({
        href: entry.href,
        id: match.nodeId,
        projectLabel: entry.projectLabel,
        score: match.score,
        sessionId: entry.sessionId || entry.projectId,
        summary: match.summary,
        title: match.title,
      })),
    ),
  };
}

export function resetGistbookAtlasCache() {
  atlasCache.clear();
}

export function getGistbookSourceRoots(options: AtlasOptions = {}) {
  return resolveRoots(options);
}
