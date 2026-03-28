export interface PageIndexDocument {
  id: string;
  title: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface PageIndexNode {
  id: string;
  documentId: string;
  title: string;
  summary: string;
  content: string;
  depth: number;
  scoreTerms: string[];
  children: PageIndexNode[];
}

export interface PageIndexTree {
  document: PageIndexDocument;
  root: PageIndexNode;
}

export interface PageIndexQueryMatch {
  nodeId: string;
  title: string;
  summary: string;
  content: string;
  depth: number;
  score: number;
}

export interface PageIndexQueryResult {
  answer: string;
  matches: PageIndexQueryMatch[];
  path: Array<{
    nodeId: string;
    title: string;
    summary: string;
    depth: number;
    score: number;
  }>;
}

export interface PageIndexBuildOptions {
  maxCharactersPerLeaf?: number;
  targetBranchCount?: number;
}

const DEFAULT_MAX_CHARACTERS_PER_LEAF = 1_600;
const DEFAULT_TARGET_BRANCH_COUNT = 6;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function tokenize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function uniqueTerms(value: string) {
  return Array.from(new Set(tokenize(value)));
}

function topTerms(value: string, limit = 8) {
  const counts = new Map<string, number>();
  tokenize(value).forEach((term) => {
    counts.set(term, (counts.get(term) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function sentenceSplit(value: string) {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9#-])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function summarizeContent(title: string, content: string, limit = 220) {
  const sentences = sentenceSplit(content);
  const lead = sentences.slice(0, 2).join(" ");
  const keywordTail = topTerms(`${title} ${content}`, 5).join(", ");
  const draft = normalizeWhitespace(
    `${lead || title}. ${keywordTail ? `Signals: ${keywordTail}.` : ""}`,
  );

  if (draft.length <= limit) {
    return draft;
  }

  return `${draft.slice(0, limit - 3).trimEnd()}...`;
}

function createLeafTitle(title: string, index: number, content: string) {
  const firstSentence = sentenceSplit(content)[0];
  if (firstSentence) {
    return toTitleCase(firstSentence.slice(0, 72));
  }

  return `${title} ${index + 1}`;
}

function splitMarkdownSections(body: string) {
  const normalized = normalizeWhitespace(body).replace(/\n{3,}/g, "\n\n");
  const lines = normalized.split("\n");
  const sections: Array<{ title: string; content: string }> = [];
  let currentTitle = "Overview";
  let currentLines: string[] = [];

  lines.forEach((line) => {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (currentLines.length) {
        sections.push({
          content: normalizeWhitespace(currentLines.join("\n")),
          title: currentTitle,
        });
      }
      currentTitle = headingMatch[2].trim();
      currentLines = [];
      return;
    }

    currentLines.push(line);
  });

  if (currentLines.length) {
    sections.push({
      content: normalizeWhitespace(currentLines.join("\n")),
      title: currentTitle,
    });
  }

  return sections.filter((section) => section.content.length > 0);
}

function splitParagraphSections(body: string, maxCharactersPerLeaf: number) {
  const paragraphs = normalizeWhitespace(body)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [];
  }

  const sections: Array<{ title: string; content: string }> = [];
  let current = "";

  paragraphs.forEach((paragraph, index) => {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxCharactersPerLeaf && current) {
      sections.push({
        content: current,
        title: `Section ${sections.length + 1}`,
      });
      current = paragraph;
      return;
    }

    current = next;

    if (index === paragraphs.length - 1 && current) {
      sections.push({
        content: current,
        title: `Section ${sections.length + 1}`,
      });
    }
  });

  return sections;
}

function splitContent(
  title: string,
  body: string,
  maxCharactersPerLeaf: number,
  targetBranchCount: number,
) {
  const markdownSections = splitMarkdownSections(body);
  if (markdownSections.length > 1) {
    return markdownSections;
  }

  const paragraphSections = splitParagraphSections(body, maxCharactersPerLeaf);
  if (paragraphSections.length > 1) {
    return paragraphSections;
  }

  const sentences = sentenceSplit(body);
  if (sentences.length <= 1) {
    return [{ content: body, title }];
  }

  const branchCount = clamp(
    Math.ceil(body.length / maxCharactersPerLeaf),
    2,
    Math.max(2, targetBranchCount),
  );
  const sentencesPerBranch = Math.max(1, Math.ceil(sentences.length / branchCount));

  const sections: Array<{ title: string; content: string }> = [];
  for (let index = 0; index < sentences.length; index += sentencesPerBranch) {
    const content = sentences.slice(index, index + sentencesPerBranch).join(" ");
    sections.push({
      content,
      title: createLeafTitle(title, sections.length, content),
    });
  }

  return sections;
}

function buildNode(args: {
  content: string;
  contextPath: string[];
  depth: number;
  documentId: string;
  maxCharactersPerLeaf: number;
  nodeId: string;
  targetBranchCount: number;
  title: string;
}): PageIndexNode {
  const normalizedContent = normalizeWhitespace(args.content);
  const contextText = [...args.contextPath, args.title].join(" ");
  if (normalizedContent.length <= args.maxCharactersPerLeaf) {
    return {
      children: [],
      content: normalizedContent,
      depth: args.depth,
      documentId: args.documentId,
      id: args.nodeId,
      scoreTerms: topTerms(`${contextText} ${normalizedContent}`),
      summary: summarizeContent(args.title, normalizedContent),
      title: args.title,
    };
  }

  const sections = splitContent(
    args.title,
    normalizedContent,
    args.maxCharactersPerLeaf,
    args.targetBranchCount,
  );

  if (sections.length <= 1) {
    return {
      children: [],
      content: normalizedContent,
      depth: args.depth,
      documentId: args.documentId,
      id: args.nodeId,
      scoreTerms: topTerms(`${contextText} ${normalizedContent}`),
      summary: summarizeContent(args.title, normalizedContent),
      title: args.title,
    };
  }

  const children = sections.map((section, index) =>
    buildNode({
      content: section.content,
      contextPath: [...args.contextPath, args.title],
      depth: args.depth + 1,
      documentId: args.documentId,
      maxCharactersPerLeaf: args.maxCharactersPerLeaf,
      nodeId: `${args.nodeId}:${index + 1}`,
      targetBranchCount: args.targetBranchCount,
      title: section.title,
    }),
  );
  const aggregatedContent = children
    .map((child) => `${child.title}\n${child.summary}`)
    .join("\n\n");

  return {
    children,
    content: aggregatedContent,
    depth: args.depth,
    documentId: args.documentId,
    id: args.nodeId,
    scoreTerms: topTerms(
      `${args.title} ${children.map((child) => `${child.title} ${child.summary}`).join(" ")}`,
      10,
    ),
    summary: summarizeContent(args.title, aggregatedContent),
    title: args.title,
  };
}

function scoreNode(queryTerms: string[], node: Pick<PageIndexNode, "summary" | "title" | "scoreTerms">) {
  if (!queryTerms.length) {
    return 0;
  }

  const termSet = new Set(node.scoreTerms);
  const textTerms = uniqueTerms(`${node.title} ${node.summary}`);
  let score = 0;
  queryTerms.forEach((term) => {
    if (termSet.has(term)) {
      score += 3;
    } else if (textTerms.includes(term)) {
      score += 2;
    } else if (node.summary.toLowerCase().includes(term) || node.title.toLowerCase().includes(term)) {
      score += 1;
    }
  });

  const overlap = queryTerms.filter((term) => node.summary.toLowerCase().includes(term)).length;
  return score + overlap / Math.max(queryTerms.length, 1);
}

function collectLeafMatches(node: PageIndexNode, queryTerms: string[], matches: PageIndexQueryMatch[] = []) {
  if (!node.children.length) {
    matches.push({
      content: node.content,
      depth: node.depth,
      nodeId: node.id,
      score: scoreNode(queryTerms, node),
      summary: node.summary,
      title: node.title,
    });
    return matches;
  }

  node.children.forEach((child) => {
    collectLeafMatches(child, queryTerms, matches);
  });
  return matches;
}

function answerFromMatches(query: string, matches: PageIndexQueryMatch[]) {
  const topMatch = matches[0];
  if (!topMatch) {
    return `No relevant passage was found for "${query}".`;
  }

  const scoredSentences = sentenceSplit(topMatch.content)
    .map((sentence) => ({
      score: tokenize(`${query} ${sentence}`).filter((term) =>
        sentence.toLowerCase().includes(term),
      ).length,
      sentence,
    }))
    .sort((left, right) => right.score - left.score || left.sentence.length - right.sentence.length)
    .slice(0, 3)
    .map((item) => item.sentence);

  const evidence = scoredSentences.length
    ? scoredSentences.join(" ")
    : topMatch.summary;

  return normalizeWhitespace(`${topMatch.title}: ${evidence}`);
}

export function buildPageIndexTree(
  document: PageIndexDocument,
  options: PageIndexBuildOptions = {},
): PageIndexTree {
  const maxCharactersPerLeaf =
    options.maxCharactersPerLeaf ?? DEFAULT_MAX_CHARACTERS_PER_LEAF;
  const targetBranchCount = options.targetBranchCount ?? DEFAULT_TARGET_BRANCH_COUNT;
  const body = normalizeWhitespace(document.body);

  return {
    document,
    root: buildNode({
      content: body,
      contextPath: [],
      depth: 0,
      documentId: document.id,
      maxCharactersPerLeaf,
      nodeId: `${document.id}:root`,
      targetBranchCount,
      title: document.title,
    }),
  };
}

export function queryPageIndexTree(
  tree: PageIndexTree,
  query: string,
  maxMatches = 3,
): PageIndexQueryResult {
  const queryTerms = uniqueTerms(query);
  const path: PageIndexQueryResult["path"] = [];
  let cursor = tree.root;

  while (cursor.children.length) {
    const rankedChildren = cursor.children
      .map((child) => ({
        child,
        score: scoreNode(queryTerms, child),
      }))
      .sort((left, right) => right.score - left.score || left.child.title.localeCompare(right.child.title));
    const best = rankedChildren[0];

    if (!best) {
      break;
    }

    path.push({
      depth: best.child.depth,
      nodeId: best.child.id,
      score: best.score,
      summary: best.child.summary,
      title: best.child.title,
    });

    if (best.score <= 0 && path.length > 1) {
      break;
    }

    cursor = best.child;
  }

  const matches = collectLeafMatches(cursor, queryTerms)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, maxMatches);

  return {
    answer: answerFromMatches(query, matches),
    matches,
    path,
  };
}
