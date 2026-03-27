import fs from "fs";
import path from "path";

type MasterPackDocIndexEntry = {
  fileName: string;
  filePath: string;
  section: string;
  slug: string[];
};

export type MasterPackDocBlock = {
  bullets: string[];
  code?: {
    language: string;
    value: string;
  };
  heading: string;
  id: string;
  paragraphs: string[];
};

export type MasterPackDoc = {
  blocks: MasterPackDocBlock[];
  fileName: string;
  section: string;
  slug: string[];
  summary: string;
  title: string;
};

const MASTER_PACK_ROOT = path.join(process.cwd(), "tianezha_master_pack");
const MASTER_PACK_DOCS_ROOT = path.join(MASTER_PACK_ROOT, "docs");
const MASTER_PACK_INDEX_PATH = path.join(MASTER_PACK_DOCS_ROOT, "DOCS_INDEX.md");

let cachedDocs: MasterPackDoc[] | null = null;

function buildId(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function slugifyFileName(fileName: string) {
  return fileName
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackTitle(fileName: string) {
  return fileName
    .replace(/\.md$/i, "")
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function flushBlock(blocks: MasterPackDocBlock[], block: MasterPackDocBlock | null) {
  if (!block) {
    return;
  }

  if (!block.paragraphs.length && !block.bullets.length && !block.code?.value.trim()) {
    return;
  }

  blocks.push({
    ...block,
    bullets: [...block.bullets],
    paragraphs: [...block.paragraphs],
    code: block.code ? { ...block.code } : undefined,
  });
}

function parseMarkdown(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: MasterPackDocBlock[] = [];
  let title = "";
  let summary = "";
  let inCodeFence = false;
  let current: MasterPackDocBlock | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("```")) {
      if (!current) {
        current = {
          bullets: [],
          heading: title || "Code",
          id: buildId(title || "code"),
          paragraphs: [],
        };
      }

      if (!inCodeFence) {
        current.code = {
          language: line.replace(/^```/, "").trim() || "text",
          value: "",
        };
        inCodeFence = true;
      } else {
        inCodeFence = false;
      }
      continue;
    }

    if (inCodeFence) {
      if (current?.code) {
        current.code.value += `${rawLine}\n`;
      }
      continue;
    }

    if (line.startsWith("# ")) {
      title = line.replace(/^#\s+/, "").trim();
      continue;
    }

    if (/^##+\s+/.test(line)) {
      flushBlock(blocks, current);
      const heading = line.replace(/^##+\s+/, "").trim();
      current = {
        bullets: [],
        heading,
        id: buildId(heading),
        paragraphs: [],
      };
      continue;
    }

    if (!current) {
      current = {
        bullets: [],
        heading: title || "Overview",
        id: buildId(title || "overview"),
        paragraphs: [],
      };
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      current.bullets.push(line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim());
      continue;
    }

    current.paragraphs.push(line);
    if (!summary) {
      summary = line;
    }
  }

  flushBlock(blocks, current);

  return {
    blocks,
    summary: summary || "Master-pack documentation page.",
    title,
  };
}

function readDocsIndex() {
  const lines = fs.readFileSync(MASTER_PACK_INDEX_PATH, "utf8").replace(/\r/g, "").split("\n");
  const entries: MasterPackDocIndexEntry[] = [];
  let currentSection = "Reference";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.endsWith(":")) {
      currentSection = line.replace(/:$/, "").trim();
      continue;
    }

    if (line.startsWith("- ")) {
      const fileName = line.replace(/^- /, "").trim();
      if (fileName.toLowerCase().endsWith(".md")) {
        entries.push({
          fileName,
          filePath: path.join(MASTER_PACK_DOCS_ROOT, fileName),
          section: currentSection,
          slug: [slugifyFileName(fileName)],
        });
      }
    }
  }

  return entries;
}

function readDirectoryEntries(args: {
  directory: string;
  section: string;
  slugPrefix: string[];
}) {
  if (!fs.existsSync(args.directory)) {
    return [] as MasterPackDocIndexEntry[];
  }

  return fs
    .readdirSync(args.directory)
    .filter((fileName) => fileName.toLowerCase().endsWith(".md"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      fileName,
      filePath: path.join(args.directory, fileName),
      section: args.section,
      slug: [...args.slugPrefix, slugifyFileName(fileName)],
    }));
}

function readDocs() {
  if (cachedDocs) {
    return cachedDocs;
  }

  const indexedEntries = readDocsIndex();
  const indexedNames = new Set(indexedEntries.map((entry) => entry.fileName));
  const extraEntries = fs
    .readdirSync(MASTER_PACK_DOCS_ROOT)
    .filter((fileName) => fileName.toLowerCase().endsWith(".md"))
    .filter((fileName) => !indexedNames.has(fileName))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      fileName,
      filePath: path.join(MASTER_PACK_DOCS_ROOT, fileName),
      section: "Reference",
      slug: [slugifyFileName(fileName)],
    }));

  const packEntries = [
    {
      fileName: "README.md",
      filePath: path.join(MASTER_PACK_ROOT, "README.md"),
      section: "Master Pack",
      slug: ["master-pack"],
    },
    ...readDirectoryEntries({
      directory: path.join(MASTER_PACK_ROOT, "tasks"),
      section: "Task Sequence",
      slugPrefix: ["tasks"],
    }),
    ...readDirectoryEntries({
      directory: path.join(MASTER_PACK_ROOT, "notes"),
      section: "Pack Notes",
      slugPrefix: ["notes"],
    }),
    ...readDirectoryEntries({
      directory: path.join(MASTER_PACK_ROOT, ".codex"),
      section: "Codex Handoff",
      slugPrefix: ["codex"],
    }),
    {
      fileName: "README.md",
      filePath: path.join(MASTER_PACK_ROOT, "lib", "README.md"),
      section: "Pack Notes",
      slug: ["pack-lib"],
    },
    {
      fileName: "README.md",
      filePath: path.join(MASTER_PACK_ROOT, "scripts", "README.md"),
      section: "Pack Notes",
      slug: ["pack-scripts"],
    },
  ].filter((entry) => fs.existsSync(entry.filePath));

  cachedDocs = [...packEntries, ...indexedEntries, ...extraEntries].map((entry) => {
    const parsed = parseMarkdown(fs.readFileSync(entry.filePath, "utf8"));

    return {
      blocks: parsed.blocks,
      fileName: entry.fileName,
      section: entry.section,
      slug: entry.slug,
      summary: parsed.summary,
      title: parsed.title || fallbackTitle(entry.fileName),
    } satisfies MasterPackDoc;
  });

  return cachedDocs;
}

export function listMasterPackDocs() {
  return readDocs();
}

export function getMasterPackDoc(slug: string[]) {
  const key = slug.join("/").trim().toLowerCase();
  return readDocs().find((doc) => doc.slug.join("/") === key) ?? null;
}

export function getMasterPackDocHref(slug: string[]) {
  return `/docs/${slug.join("/")}`;
}

export function listMasterPackDocsBySection() {
  const grouped = new Map<string, MasterPackDoc[]>();

  for (const doc of readDocs()) {
    const current = grouped.get(doc.section) ?? [];
    current.push(doc);
    grouped.set(doc.section, current);
  }

  return [...grouped.entries()].map(([section, docs]) => ({
    docs,
    section,
  }));
}
