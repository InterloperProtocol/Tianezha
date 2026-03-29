import { describe, expect, it } from "vitest";

import {
  getConfiguredRepoMcpServerNames,
  getTianshiSkillHubSummary,
  getVendoredTianshiSkillNames,
} from "@/lib/server/tianshi-tooling-catalog";

describe("tianshi tooling catalog", () => {
  it("discovers the vendored skill hub in the runtime vendor tree", () => {
    const vendoredSkillNames = getVendoredTianshiSkillNames(
      "services/tianshi-automaton/vendor",
    );

    expect(vendoredSkillNames).toContain("skill-hub");
  });

  it("summarizes the skill hub registry by install class", () => {
    const summary = getTianshiSkillHubSummary();

    expect(summary.available).toBe(true);
    expect(summary.name).toBe("Tianshi Skill Hub");
    expect(summary.vendorableAdapterNames).toEqual(
      expect.arrayContaining([
        "Panniantong/Agent-Reach",
        "feuersteiner/contextrie",
        "GetStream/Vision-Agents",
        "iflytek/skillhub",
      ]),
    );
    expect(summary.optionalAdapterNames).toEqual(
      expect.arrayContaining([
        "aden-hive/hive",
        "we-promise/sure",
        "firecrawl/open-lovable",
      ]),
    );
    expect(summary.referenceNames).toEqual(
      expect.arrayContaining([
        "mtdvio/every-programmer-should-know",
        "YouMind-OpenLab/awesome-nano-banana-pro-prompts",
      ]),
    );
    expect(summary.outOfScopeNames).toEqual(
      expect.arrayContaining([
        "fluxerapp/fluxer",
        "pear-devs/pear-desktop",
        "felixrieseberg/windows95",
      ]),
    );
  });

  it("keeps the repo-local MCP manifest discoverable", () => {
    expect(getConfiguredRepoMcpServerNames()).toEqual(
      expect.arrayContaining([
        "bnbchain-mcp",
        "context7",
        "taskmaster",
      ]),
    );
  });
});
