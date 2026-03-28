import type { CanonicalMeshState, SavegameBundle } from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

export function createSavegameBundle(state: CanonicalMeshState): SavegameBundle {
  return {
    exportedAt: nowIso(),
    state,
    version: "tianezha-savegame/v1",
  };
}

export function stringifySavegameBundle(bundle: SavegameBundle) {
  return JSON.stringify(bundle, null, 2);
}

export function parseSavegameBundle(source: string): SavegameBundle {
  const parsed = JSON.parse(source) as SavegameBundle;
  if (parsed.version !== "tianezha-savegame/v1") {
    throw new Error("Unsupported Tianezha savegame version.");
  }

  return parsed;
}

export function restoreSavegameBundle(bundle: SavegameBundle): CanonicalMeshState {
  if (bundle.version !== "tianezha-savegame/v1") {
    throw new Error("Unsupported Tianezha savegame version.");
  }

  return bundle.state;
}
