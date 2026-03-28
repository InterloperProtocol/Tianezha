import {
  exportMeshCommerceSavegame,
  getMeshCommerceState,
  getMeshCommerceSummary,
  importMeshCommerceSavegame,
  resetMeshCommerceState,
  saveMeshCommerceState,
} from "@/lib/server/mesh-commerce";

describe("mesh commerce runtime", () => {
  beforeEach(() => {
    resetMeshCommerceState();
  });

  it("boots with optional adapters disabled and keeps wallet connect off", () => {
    process.env.TIANEZHA_ENABLE_CANCERHAWK = "0";
    process.env.TIANEZHA_ENABLE_CANCER_PREDICTION = "0";
    process.env.TIANEZHA_DISABLE_GISTBOOK = "0";

    const summary = getMeshCommerceSummary();

    expect(summary.state.community.walletConnectRequired).toBe(false);
    expect(summary.vendors.conwayRequired).toBe(false);
    expect(summary.compute.openOffers).toBeGreaterThan(0);
    expect(summary.adapters.cancerhawkEnabled).toBe(false);
    expect(summary.adapters.cancerPredictionEnabled).toBe(false);
    expect(summary.subagents.mcpServerNames).toEqual(
      expect.arrayContaining([
        "bnbchain-mcp",
        "solana-developer-mcp",
        "sendaifun-solana-mcp",
      ]),
    );
    expect(
      summary.subagents.actorMcpBindings.every(
        (binding) =>
          binding.mcpServerNames.includes("bnbchain-mcp") &&
          binding.mcpServerNames.includes("solana-developer-mcp") &&
          binding.mcpServerNames.includes("sendaifun-solana-mcp"),
      ),
    ).toBe(true);
  });

  it("exports and imports the mesh savegame without losing reference prices", () => {
    const exported = exportMeshCommerceSavegame();
    const restored = importMeshCommerceSavegame(exported);

    expect(restored.computePriceMarkets.referencePrices.length).toBeGreaterThan(0);
    expect(restored.vendorMarket.domainOffers.length).toBeGreaterThan(0);
    expect(restored.rewards.entries.some((entry) => entry.kind === "proof_of_compute")).toBe(
      true,
    );
  });

  it("backfills chain MCP bindings into existing saved subagent state", () => {
    const state = getMeshCommerceState();
    saveMeshCommerceState({
      ...state,
      subagents: {
        ...state.subagents,
        actors: state.subagents.actors.map((actor) => {
          const nextActor = { ...actor };
          delete nextActor.metadata;
          return nextActor;
        }),
      },
    });

    const summary = getMeshCommerceSummary();

    expect(
      summary.subagents.actorMcpBindings.every(
        (binding) =>
          binding.mcpServerNames.includes("bnbchain-mcp") &&
          binding.mcpServerNames.includes("solana-developer-mcp") &&
          binding.mcpServerNames.includes("sendaifun-solana-mcp"),
      ),
    ).toBe(true);
  });
});
