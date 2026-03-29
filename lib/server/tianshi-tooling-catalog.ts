import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import os from "os";
import path from "path";

import { getSkillHubSummary } from "@/packages/adapters/src/skillhub";

const CURATED_CODEX_SKILLS = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "doc-coauthoring",
  "frontend-design",
  "canvas-design",
  "algorithmic-art",
  "theme-factory",
  "web-artifacts-builder",
  "brand-guidelines",
  "skill-creator",
  "mcp-builder",
  "tokenized-agents",
];

const TIANEZHA_CHAIN_MCP_SERVER_NAMES = [
  "bnbchain-mcp",
  "solana-developer-mcp",
  "sendaifun-solana-mcp",
] as const;

function sortNames(names: Iterable<string>) {
  return Array.from(new Set(names)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function listSkillNamesRecursive(rootPath: string) {
  if (!rootPath || !existsSync(rootPath)) {
    return [];
  }

  const discovered = new Set<string>();
  const queue = [path.resolve(rootPath)];
  const seen = new Set<string>();

  while (queue.length) {
    const current = queue.pop();
    if (!current || seen.has(current) || !existsSync(current)) {
      continue;
    }
    seen.add(current);

    let stats;
    try {
      stats = statSync(current);
    } catch {
      continue;
    }

    if (!stats.isDirectory()) {
      continue;
    }

    const skillFile = path.join(current, "SKILL.md");
    if (existsSync(skillFile)) {
      discovered.add(path.basename(current));
      continue;
    }

    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      queue.push(path.join(current, entry.name));
    }
  }

  return sortNames(discovered);
}

export function getVendoredTianshiSkillNames(skillRoot: string) {
  return listSkillNamesRecursive(skillRoot);
}

export function getInstalledLocalCodexSkillNames() {
  const codexSkillsPath = path.join(os.homedir(), ".codex", "skills");
  return CURATED_CODEX_SKILLS.filter((name) =>
    existsSync(path.join(codexSkillsPath, name, "SKILL.md")),
  );
}

export function getTianezhaChainMcpServerNames() {
  return [...TIANEZHA_CHAIN_MCP_SERVER_NAMES];
}

export function getConfiguredRepoMcpServerNames() {
  const aggregateConfigPath = path.resolve(
    process.cwd(),
    "services/tianshi-automaton/mcp/tianshi-codex.config.json",
  );

  if (existsSync(aggregateConfigPath)) {
    try {
      const parsed = JSON.parse(readFileSync(aggregateConfigPath, "utf8")) as {
        mcpServers?: Record<string, unknown>;
      };
      return sortNames(Object.keys(parsed.mcpServers || {}));
    } catch {
      return [];
    }
  }

  const mcpDir = path.resolve(process.cwd(), "services/tianshi-automaton/mcp");
  if (!existsSync(mcpDir)) {
    return [];
  }

  return sortNames(
    readdirSync(mcpDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".config.json") &&
          entry.name !== "tianshi-codex.config.json",
      )
      .map((entry) => entry.name.replace(/\.config\.json$/, "")),
  );
}

export function getTianshiSkillHubSummary() {
  return getSkillHubSummary();
}
