import {
  createPrincipalChain,
  createPrincipalLink,
  createRaSubagentActor,
  createTianshiRuntimeActor,
} from "@/packages/core/src/subagents";

describe("subagent registry", () => {
  it("requires market actors to terminate in a human principal", () => {
    expect(() =>
      createPrincipalChain([createPrincipalLink("agent:1", "agent", "Agent 1")]),
    ).toThrow(/human principal/i);
  });

  it("creates Tianshi and RA actors as commercial actors", () => {
    const tianshi = createTianshiRuntimeActor({
      humanPrincipalId: "human:owner",
      humanPrincipalLabel: "Owner",
      mcpServerNames: ["bnbchain-mcp", "solana-developer-mcp"],
    });
    const ra = createRaSubagentActor({
      actorId: "actor:ra:1",
      capabilities: ["compute", "prompt_processing"],
      humanPrincipalId: "human:owner",
      humanPrincipalLabel: "Owner",
      label: "RA Analyst",
      mcpServerNames: ["sendaifun-solana-mcp"],
      nodeId: "peer:ra:1",
    });

    expect(tianshi.principalChain.terminalHumanId).toBe("human:owner");
    expect(ra.principalChain.terminalHumanId).toBe("human:owner");
    expect(tianshi.metadata?.mcpServerNames).toEqual([
      "bnbchain-mcp",
      "solana-developer-mcp",
    ]);
    expect(ra.metadata?.mcpServerNames).toEqual(["sendaifun-solana-mcp"]);
  });
});
