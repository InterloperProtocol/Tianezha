import {
  CONSTITUTION,
  assertConstitutionInvariant,
  deepFreeze,
  invariant,
} from "@/lib/constitution";
import type {
  ConstitutionConfig,
  ReadonlyDeep,
} from "@/lib/types/constitution";
import {
  CHILD_EXECUTION_RULE,
  type BrainConfig,
  type BrainId,
  type PublicBrainSummary,
} from "@/lib/types/brains";

import { BOLCLAW_BRAIN } from "./bolclaw";
import { GOONCLAW_CORE_BRAIN } from "./goonclaw";
import { OUTOFORDER_BRAIN } from "./outoforder";
import { TRENCHSTROKER_BRAIN } from "./trenchstroker";

const ALL_BRAINS = [
  GOONCLAW_CORE_BRAIN,
  BOLCLAW_BRAIN,
  TRENCHSTROKER_BRAIN,
  OUTOFORDER_BRAIN,
] as const satisfies ReadonlyArray<BrainConfig>;

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function assertBrainRegistryInvariant(
  brains: ReadonlyArray<BrainConfig> = ALL_BRAINS,
  cfg: ReadonlyDeep<ConstitutionConfig> = CONSTITUTION,
) {
  assertConstitutionInvariant(cfg);

  const parents = brains.filter((brain) => brain.sovereignty === "parent");
  const children = brains.filter((brain) => brain.sovereignty === "child");
  invariant(parents.length === 1, "Expected exactly one sovereign parent brain.");
  invariant(children.length === 3, "Expected exactly three constitutional child brains.");

  const parent = parents[0];
  invariant(
    parent.id === cfg.parentChildPolicy.sovereignParentBrainId,
    "Parent brain id drift detected.",
  );
  invariant(
    parent.displayName === cfg.parentChildPolicy.sovereignParentDisplayName,
    "Parent display name drift detected.",
  );
  invariant(
    parent.executionBoundary === "sovereign_parent" &&
      parent.canTradeDirectly === true &&
      parent.canAccessTreasury === true,
    "Parent brain must retain sovereign execution rights.",
  );

  const expectedChildIds = [...cfg.parentChildPolicy.childBrainIds].sort();
  const actualChildIds = children.map((brain) => brain.id).sort();
  invariant(
    JSON.stringify(actualChildIds) === JSON.stringify(expectedChildIds),
    "Child brain registry drift detected.",
  );

  const seenIds = new Set<string>();
  const seenDomains = new Set<string>();
  const seenLoadPaths = new Set<string>();

  for (const brain of brains) {
    invariant(!seenIds.has(brain.id), `Duplicate brain id: ${brain.id}`);
    invariant(
      !seenDomains.has(normalizeDomain(brain.domain)),
      `Duplicate brain domain: ${brain.domain}`,
    );
    invariant(
      !seenLoadPaths.has(brain.loadPath),
      `Duplicate brain load path: ${brain.loadPath}`,
    );

    seenIds.add(brain.id);
    seenDomains.add(normalizeDomain(brain.domain));
    seenLoadPaths.add(brain.loadPath);

    invariant(
      brain.loadPath === cfg.parentChildPolicy.canonicalLoadTargets[brain.id],
      `Load path drift detected for ${brain.id}.`,
    );
    invariant(
      brain.canAccessSecrets === false,
      `Brains must never expose direct secret access: ${brain.id}`,
    );
  }

  for (const child of children) {
    invariant(
      child.parentBrainId === parent.id,
      `Child brain ${child.id} must inherit from ${parent.id}.`,
    );
    invariant(
      child.executionBoundary === "proposal_only",
      `Child brain ${child.id} must remain proposal-only.`,
    );
    invariant(
      child.canTradeDirectly === false &&
        child.canAccessTreasury === false &&
        child.canAccessSecrets === false,
      `Child brain ${child.id} exceeded its constitutional boundary.`,
    );
  }

  invariant(
    cfg.parentChildPolicy.executionBoundary.rule === CHILD_EXECUTION_RULE,
    "Parent/child execution rule drift detected.",
  );
}

function toPublicBrainSummary(brain: BrainConfig): PublicBrainSummary {
  return {
    id: brain.id,
    displayName: brain.displayName,
    aliases: brain.aliases,
    sovereignty: brain.sovereignty,
    parentBrainId: brain.parentBrainId,
    domain: brain.domain,
    loadPath: brain.loadPath,
    tone: brain.tone,
    specialization: brain.specialization,
    riskProfile: brain.riskProfile,
    canPost: brain.canPost,
    canPublishThesis: brain.canPublishThesis,
    canSurfaceWalletIntel: brain.canSurfaceWalletIntel,
    canRequestTrades: brain.canRequestTrades,
    canTradeDirectly: brain.canTradeDirectly,
    canAccessTreasury: brain.canAccessTreasury,
    canAccessSecrets: brain.canAccessSecrets,
    canSellBillboards: brain.canSellBillboards,
    canOperateLivestream: brain.canOperateLivestream,
    publicRoutes: brain.publicRoutes,
    status: brain.status,
    executionBoundary: brain.executionBoundary,
    executionRule: CHILD_EXECUTION_RULE,
    summary: brain.summary,
  };
}

const BRAIN_REGISTRY_INTERNAL = deepFreeze({
  all: ALL_BRAINS,
  parent: GOONCLAW_CORE_BRAIN,
  children: ALL_BRAINS.filter(
    (brain) => brain.sovereignty === "child",
  ) as ReadonlyArray<BrainConfig>,
});

assertBrainRegistryInvariant(BRAIN_REGISTRY_INTERNAL.all, CONSTITUTION);

export const SOVEREIGN_PARENT_BRAIN = BRAIN_REGISTRY_INTERNAL.parent;
export const CHILD_BRAINS = BRAIN_REGISTRY_INTERNAL.children;
export const PUBLIC_SOVEREIGN_PARENT_BRAIN = toPublicBrainSummary(
  SOVEREIGN_PARENT_BRAIN,
);
export const PUBLIC_CHILD_BRAINS = CHILD_BRAINS.map(toPublicBrainSummary);

export function listAllBrains(): ReadonlyArray<BrainConfig> {
  return BRAIN_REGISTRY_INTERNAL.all;
}

export function listChildBrains(): ReadonlyArray<BrainConfig> {
  return CHILD_BRAINS;
}

export function listPublicChildBrains(): ReadonlyArray<PublicBrainSummary> {
  return PUBLIC_CHILD_BRAINS;
}

export function getBrainById(brainId: string): BrainConfig | undefined {
  return BRAIN_REGISTRY_INTERNAL.all.find((brain) => brain.id === brainId);
}

export function getChildBrainById(brainId: string): BrainConfig | undefined {
  return CHILD_BRAINS.find((brain) => brain.id === brainId);
}

export function getPublicBrainSummary(
  brainId: string,
): PublicBrainSummary | undefined {
  const brain = getBrainById(brainId);
  return brain ? toPublicBrainSummary(brain) : undefined;
}

export function getPublicChildBrainSummary(
  brainId: string,
): PublicBrainSummary | undefined {
  const brain = getChildBrainById(brainId);
  return brain ? toPublicBrainSummary(brain) : undefined;
}

export function getBrainByDomain(domain: string): BrainConfig | undefined {
  const normalized = normalizeDomain(domain);
  return BRAIN_REGISTRY_INTERNAL.all.find(
    (brain) => normalizeDomain(brain.domain) === normalized,
  );
}

export function getBrainLoadPath(brainId: BrainId): `brains/${BrainId}` {
  const brain = getBrainById(brainId);
  invariant(brain, `Unknown brain id: ${brainId}`);
  return brain.loadPath;
}
