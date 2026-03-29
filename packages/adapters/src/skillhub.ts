import { existsSync, readFileSync } from "fs";
import path from "path";

export type SkillHubClass =
  | "vendorable_adapter"
  | "optional_adapter"
  | "documentation_only_reference"
  | "out_of_scope";

export type SkillHubInstallTarget = "vendor" | "sidecar" | "docs" | "exclude";

export interface SkillHubRegistryEntry {
  id: string;
  repo: string;
  sourceUrl: string;
  skillClass: SkillHubClass;
  installTarget: SkillHubInstallTarget;
  notes: string;
}

export interface SkillHubRegistry {
  name: string;
  version: number;
  summary: string;
  entries: SkillHubRegistryEntry[];
}

export interface SkillHubSummary {
  available: boolean;
  entryCount: number;
  name: string;
  optionalAdapterCount: number;
  optionalAdapterNames: string[];
  outOfScopeCount: number;
  outOfScopeNames: string[];
  referenceCount: number;
  referenceNames: string[];
  summary: string;
  vendorableAdapterCount: number;
  vendorableAdapterNames: string[];
  version: number | null;
}

const DEFAULT_REGISTRY_PATH = path.resolve(
  process.cwd(),
  "services/tianshi-automaton/vendor/skill-hub/registry.json",
);

function sortNames(names: Iterable<string>) {
  return Array.from(new Set(names)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function emptySummary(): SkillHubSummary {
  return {
    available: false,
    entryCount: 0,
    name: "Tianshi Skill Hub",
    optionalAdapterCount: 0,
    optionalAdapterNames: [],
    outOfScopeCount: 0,
    outOfScopeNames: [],
    referenceCount: 0,
    referenceNames: [],
    summary:
      "Canonical repo registry for vendorable adapters, optional sidecars, and reference-only research material.",
    vendorableAdapterCount: 0,
    vendorableAdapterNames: [],
    version: null,
  };
}

function normalizeEntry(value: unknown): SkillHubRegistryEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<SkillHubRegistryEntry>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.repo !== "string" ||
    typeof entry.sourceUrl !== "string" ||
    typeof entry.skillClass !== "string" ||
    typeof entry.installTarget !== "string" ||
    typeof entry.notes !== "string"
  ) {
    return null;
  }

  return {
    id: entry.id,
    installTarget: entry.installTarget as SkillHubInstallTarget,
    notes: entry.notes,
    repo: entry.repo,
    skillClass: entry.skillClass as SkillHubClass,
    sourceUrl: entry.sourceUrl,
  };
}

function readRegistryInternal(registryPath: string): SkillHubRegistry | null {
  if (!registryPath || !existsSync(registryPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(registryPath, "utf8")) as {
      entries?: unknown;
      name?: unknown;
      summary?: unknown;
      version?: unknown;
    };

    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.map(normalizeEntry).filter((entry): entry is SkillHubRegistryEntry => Boolean(entry))
      : [];

    if (typeof parsed.name !== "string" || typeof parsed.summary !== "string") {
      return null;
    }

    return {
      entries,
      name: parsed.name,
      summary: parsed.summary,
      version:
        typeof parsed.version === "number" && Number.isFinite(parsed.version)
          ? parsed.version
          : 1,
    };
  } catch {
    return null;
  }
}

function summarizeRegistry(registry: SkillHubRegistry | null): SkillHubSummary {
  if (!registry) {
    return emptySummary();
  }

  const vendorableAdapterNames = sortNames(
    registry.entries
      .filter((entry) => entry.skillClass === "vendorable_adapter")
      .map((entry) => entry.repo),
  );
  const optionalAdapterNames = sortNames(
    registry.entries
      .filter((entry) => entry.skillClass === "optional_adapter")
      .map((entry) => entry.repo),
  );
  const referenceNames = sortNames(
    registry.entries
      .filter((entry) => entry.skillClass === "documentation_only_reference")
      .map((entry) => entry.repo),
  );
  const outOfScopeNames = sortNames(
    registry.entries
      .filter((entry) => entry.skillClass === "out_of_scope")
      .map((entry) => entry.repo),
  );

  return {
    available: true,
    entryCount: registry.entries.length,
    name: registry.name,
    optionalAdapterCount: optionalAdapterNames.length,
    optionalAdapterNames,
    outOfScopeCount: outOfScopeNames.length,
    outOfScopeNames,
    referenceCount: referenceNames.length,
    referenceNames,
    summary: registry.summary,
    vendorableAdapterCount: vendorableAdapterNames.length,
    vendorableAdapterNames,
    version: registry.version,
  };
}

export function getDefaultSkillHubRegistryPath() {
  return DEFAULT_REGISTRY_PATH;
}

export function readSkillHubRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  return readRegistryInternal(registryPath);
}

export function getSkillHubSummary(registryPath = DEFAULT_REGISTRY_PATH) {
  return summarizeRegistry(readRegistryInternal(registryPath));
}
