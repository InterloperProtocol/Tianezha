import { buildPageIndexTree, queryPageIndexTree } from "@/packages/core/src/pageindexRag";

describe("pageindexRag", () => {
  it("builds a hierarchical tree and routes queries to the right branch", () => {
    const tree = buildPageIndexTree({
      body: `
# Product

## Architecture

The runtime keeps sovereign state inside the parent brain boundary and exports read-only status.
Compute spot offers clear inside the native mesh before adapter settlement executes.

## Gistbook

Gistbook wraps prompt notes, session memory, and change cards around Tianezha boxes.
It exposes a vectorless session atlas with hover cards and in-browser resume routes.

## Payments

Payment rails are adapters.
Conway is optional and x402 can run independently.
      `,
      id: "doc:gistbook",
      title: "Gistbook architecture",
    }, {
      maxCharactersPerLeaf: 120,
    });

    const result = queryPageIndexTree(tree, "How does Gistbook resume past sessions?");

    expect(result.path.length).toBeGreaterThan(0);
    expect(result.path.some((entry) => entry.title.includes("Gistbook"))).toBe(true);
    expect(result.answer).toContain("resume");
  });

  it("falls back to the best leaf even when the document has no headings", () => {
    const tree = buildPageIndexTree({
      body:
        "First the operator opens the dashboard. Then the atlas builds a project memory reel. " +
        "Finally the vectorless query walks the tree and extracts the most relevant session turns.",
      id: "doc:plain",
      title: "Plain session brief",
    });

    const result = queryPageIndexTree(tree, "How does the query work?");

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.answer.toLowerCase()).toContain("query");
  });
});
