import { describe, expect, it } from "vitest";

import {
  PUBLIC_CHILD_BRAINS,
  PUBLIC_SOVEREIGN_PARENT_BRAIN,
  getBrainByDomain,
  getBrainLoadPath,
} from "@/lib/brains/registry";

describe("brain registry", () => {
  it("exposes one sovereign parent and three constitutional child brains", () => {
    expect(PUBLIC_SOVEREIGN_PARENT_BRAIN.id).toBe("tianshi");
    expect(PUBLIC_CHILD_BRAINS.map((brain) => brain.id)).toEqual([
      "bolclaw",
      "trenchstroker",
      "outoforder",
    ]);
  });

  it("resolves brains by deployed domain", () => {
    expect(getBrainByDomain("https://bolclaw.fun/live")?.id).toBe("bolclaw");
    expect(getBrainByDomain("outoforder.fun")?.id).toBe("outoforder");
  });

  it("keeps child brains out of direct treasury execution", () => {
    for (const brain of PUBLIC_CHILD_BRAINS) {
      expect(brain.canTradeDirectly).toBe(false);
      expect(brain.canAccessTreasury).toBe(false);
      expect(brain.canAccessSecrets).toBe(false);
    }

    expect(getBrainLoadPath("tianshi")).toBe("brains/tianshi");
  });
});
