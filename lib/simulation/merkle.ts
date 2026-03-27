import { sha256Hex } from "@/lib/utils";

import type { MerkleSnapshotKind, MerkleSnapshotRecord } from "@/lib/simulation/types";

function hashPair(left: string, right: string) {
  return sha256Hex(`${left}:${right}`);
}

export function createMerkleLeaves(kind: MerkleSnapshotKind, entityIds: string[]) {
  return [...entityIds]
    .sort((left, right) => left.localeCompare(right))
    .map((entityId) => sha256Hex(`v1:${kind}:${entityId}`));
}

export function createMerkleRoot(kind: MerkleSnapshotKind, entityIds: string[]) {
  const leaves = createMerkleLeaves(kind, entityIds);
  if (!leaves.length) {
    return sha256Hex(`v1:${kind}:empty`);
  }

  let level = leaves;
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      nextLevel.push(hashPair(left, right));
    }
    level = nextLevel;
  }

  return level[0];
}

export function buildMerkleSnapshot(args: {
  checkpointAt: string;
  entityIds: string[];
  kind: MerkleSnapshotKind;
}): MerkleSnapshotRecord {
  return {
    checkpointAt: args.checkpointAt,
    createdAt: args.checkpointAt,
    entityIds: [...args.entityIds].sort((left, right) => left.localeCompare(right)),
    id: `${args.kind}:${args.checkpointAt}`,
    kind: args.kind,
    leafCount: args.entityIds.length,
    root: createMerkleRoot(args.kind, args.entityIds),
  };
}
