import type {
  MarketActor,
  PrincipalChain,
  PrincipalLink,
  SubagentRegistryState,
} from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

export function createPrincipalLink(
  id: string,
  kind: PrincipalLink["kind"],
  label: string,
): PrincipalLink {
  return { id, kind, label };
}

export function createPrincipalChain(links: PrincipalLink[]): PrincipalChain {
  if (!links.length) {
    throw new Error("Commercial actors must have a principal chain.");
  }

  const terminalLink = links[links.length - 1];
  if (terminalLink.kind !== "human") {
    throw new Error("Principal chains must terminate in a human principal.");
  }

  return {
    links,
    terminalHumanId: terminalLink.id,
  };
}

export function assertCommercialActor(actor: MarketActor) {
  const terminalLink = actor.principalChain.links[actor.principalChain.links.length - 1];
  if (!terminalLink || terminalLink.kind !== "human") {
    throw new Error(`${actor.label} is missing a terminal human principal.`);
  }

  return actor;
}

export function createSubagentRegistryState(
  actors: MarketActor[] = [],
): SubagentRegistryState {
  return {
    actors: actors.map((actor) => assertCommercialActor(actor)),
    id: "tianezha-subagent-registry",
    updatedAt: nowIso(),
  };
}

export function upsertMarketActor(
  state: SubagentRegistryState,
  actor: MarketActor,
): SubagentRegistryState {
  assertCommercialActor(actor);
  const actors = state.actors.filter((entry) => entry.id !== actor.id);
  return {
    ...state,
    actors: [...actors, { ...actor, updatedAt: nowIso() }].sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
    updatedAt: nowIso(),
  };
}

export function createTianshiRuntimeActor(args: {
  humanPrincipalId: string;
  humanPrincipalLabel: string;
  mcpServerNames?: string[];
}): MarketActor {
  const timestamp = nowIso();
  return {
    capabilities: [
      "compute",
      "prompt_processing",
      "model_execution",
      "storage",
      "preservation",
    ],
    createdAt: timestamp,
    id: "actor:tianshi",
    kind: "runtime" as const,
    label: "Tianshi",
    metadata: args.mcpServerNames?.length
      ? { mcpServerNames: [...args.mcpServerNames] }
      : undefined,
    nodeId: "peer:tianshi-local",
    principalChain: createPrincipalChain([
      createPrincipalLink("actor:tianshi", "agent", "Tianshi"),
      createPrincipalLink(
        args.humanPrincipalId,
        "human",
        args.humanPrincipalLabel,
      ),
    ]),
    updatedAt: timestamp,
  };
}

export function createRaSubagentActor(args: {
  actorId: string;
  label: string;
  nodeId: string;
  humanPrincipalId: string;
  humanPrincipalLabel: string;
  capabilities: MarketActor["capabilities"];
  mcpServerNames?: string[];
}): MarketActor {
  const timestamp = nowIso();
  return {
    capabilities: args.capabilities,
    createdAt: timestamp,
    id: args.actorId,
    kind: "agent" as const,
    label: args.label,
    metadata: args.mcpServerNames?.length
      ? { mcpServerNames: [...args.mcpServerNames] }
      : undefined,
    nodeId: args.nodeId,
    principalChain: createPrincipalChain([
      createPrincipalLink(args.actorId, "agent", args.label),
      createPrincipalLink(args.humanPrincipalId, "human", args.humanPrincipalLabel),
    ]),
    updatedAt: timestamp,
  };
}
