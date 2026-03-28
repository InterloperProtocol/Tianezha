import { renderAsyncComponent } from "@/tests/regression/helpers/render";

vi.mock("@/components/shell/TianezhaScaffold", () => import("@/tests/regression/helpers/mock-scaffold"));

import GistbookPage from "@/app/gistbook/page";
import GistbookSessionPage from "@/app/gistbook/session/[sessionId]/page";
import { resetGistbookAtlasCache } from "@/lib/server/gistbook-session-intelligence";

describe("gistbook dashboard", () => {
  beforeEach(() => {
    process.env.GISTBOOK_CLAUDE_ROOT = "tests/fixtures/gistbook/claude";
    process.env.GISTBOOK_CODEX_ROOT = "tests/fixtures/gistbook/codex";
    resetGistbookAtlasCache();
  });

  it("renders the session atlas shell with vectorless rag surfaces", async () => {
    const html = await renderAsyncComponent(GistbookPage, {
      searchParams: Promise.resolve({}),
    });

    expect(html).toContain("Vectorless session atlas for Claude Code memory.");
    expect(html).toContain("3D token usage over time");
    expect(html).toContain("Project footprint");
  });

  it("renders the in-browser resume page for a recovered session", async () => {
    const html = await renderAsyncComponent(GistbookSessionPage, {
      params: Promise.resolve({ sessionId: "019d-example-session" }),
    });

    expect(html).toContain("Build session atlas");
    expect(html).toContain("Session PageIndex console");
    expect(html).toContain("Full in-browser resume view");
    expect(html).toContain("browser resume route now");
  });
});
