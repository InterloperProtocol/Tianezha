import path from "path";

import {
  getGistbookDashboard,
  getGistbookSessionDetail,
  listGistbookSessions,
  queryGistbookRag,
  resetGistbookAtlasCache,
} from "@/lib/server/gistbook-session-intelligence";

const fixtureRoot = path.resolve(process.cwd(), "tests/fixtures/gistbook");
const claudeRoot = path.join(fixtureRoot, "claude");
const codexRoot = path.join(fixtureRoot, "codex");

describe("gistbook session intelligence", () => {
  beforeEach(() => {
    resetGistbookAtlasCache();
  });

  it("builds a dashboard from local Claude and Codex fixtures", () => {
    const { dashboard, projectMemories } = getGistbookDashboard({
      claudeRoot,
      codexRoot,
      now: new Date("2026-03-27T12:00:00.000Z"),
    });

    expect(dashboard.totals.sessions).toBe(2);
    expect(dashboard.totals.projects).toBe(2);
    expect(projectMemories.length).toBe(2);
    expect(dashboard.recentCards[0]?.title).toBeTruthy();
  });

  it("returns session detail with a page index tree", () => {
    const sessions = listGistbookSessions({ claudeRoot, codexRoot });
    const detail = getGistbookSessionDetail(sessions[0]!.id, { claudeRoot, codexRoot });

    expect(detail).not.toBeNull();
    expect(detail?.tree.root.summary).toBeTruthy();
    expect(detail?.session.messages.length).toBeGreaterThan(0);
  });

  it("answers vectorless rag queries inside the scoped corpus", () => {
    const answer = queryGistbookRag("Which sessions talk about vectorless rag?", {
      claudeRoot,
      codexRoot,
    });

    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.answer.toLowerCase()).toContain("vectorless");
  });
});
