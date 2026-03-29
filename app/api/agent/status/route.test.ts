import { beforeEach, describe, expect, it, vi } from "vitest";

const autonomousAgentModule = vi.hoisted(() => ({
  getAutonomousStatusWithLiveReserve: vi.fn(),
}));

vi.mock("@/lib/server/autonomous-agent", () => autonomousAgentModule);

import { GET } from "@/app/api/agent/status/route";

describe("/api/agent/status GET", () => {
  beforeEach(() => {
    autonomousAgentModule.getAutonomousStatusWithLiveReserve.mockReset();
  });

  it("includes the Tianshi surface metadata and constitution snapshot", async () => {
    autonomousAgentModule.getAutonomousStatusWithLiveReserve.mockResolvedValue({
      agentId: "tianshi-autonomous-agent",
      treasury: {
        reserveFloorSol: 0.6942,
        reserveSol: 0.9,
      },
    });

    const response = await GET();
    const payload = (await response.json()) as {
      heartBeat?: { surfaceName?: string; route?: string; brainsRoute?: string };
      constitution?: { reserve?: { floorLamports?: string } };
      economics?: { creatorFees?: { agentShare?: number } };
      treasury?: { reserveFloorSol?: number };
      treasuryPosture?: { availableAboveReserveLamports?: string };
      brains?: { executionRule?: string; parentBrain?: { id?: string } };
      reserveFloor?: { floorLamports?: string };
      creatorFeePolicy?: { agentShare?: number };
      tradingProfitPolicy?: { governanceBranch?: number };
      governanceMode?: string;
      parentBrain?: { id?: string; aliases?: string[] };
      childBrainCount?: number;
      childBrainIds?: string[];
      socialCapitalMode?: { goal?: string };
      financialCapitalMode?: { reserveHealthy?: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.heartBeat?.surfaceName).toBe("Tianshi");
    expect(payload.heartBeat?.route).toBe("/api/agent/status");
    expect(payload.heartBeat?.brainsRoute).toBe("/api/brains");
    expect(payload.constitution?.reserve?.floorLamports).toBe("694200000");
    expect(payload.economics?.creatorFees?.agentShare).toBe(0.51);
    expect(payload.treasury?.reserveFloorSol).toBe(0.6942);
    expect(payload.treasuryPosture?.availableAboveReserveLamports).toBe(
      "205800000",
    );
    expect(payload.reserveFloor?.floorLamports).toBe("694200000");
    expect(payload.creatorFeePolicy?.agentShare).toBe(0.51);
    expect(payload.tradingProfitPolicy?.governanceBranch).toBe(0.5);
    expect(payload.governanceMode).toBe("liquidity");
    expect(payload.parentBrain?.id).toBe("tianshi");
    expect(payload.parentBrain?.aliases).toContain("Tianshi Prime");
    expect(payload.childBrainCount).toBe(3);
    expect(payload.childBrainIds).toEqual([
      "bolclaw",
      "trenchstroker",
      "outoforder",
    ]);
    expect(payload.socialCapitalMode?.goal).toBe("most_followed_agent_kol");
    expect(payload.financialCapitalMode?.reserveHealthy).toBe(true);
    expect(payload.brains?.parentBrain?.id).toBe("tianshi");
    expect(payload.brains?.executionRule).toBe(
      "Children may think locally, but only the parent executes globally.",
    );
  });

  it("forwards the shared skill hub summary into the public status surface", async () => {
    autonomousAgentModule.getAutonomousStatusWithLiveReserve.mockResolvedValue({
      agentId: "tianshi-autonomous-agent",
      tooling: {
        skillHub: {
          available: true,
          entryCount: 2,
          name: "Tianshi Skill Hub",
          optionalAdapterCount: 0,
          optionalAdapterNames: [],
          outOfScopeCount: 0,
          outOfScopeNames: [],
          referenceCount: 0,
          referenceNames: [],
          summary: "Canonical registry",
          vendorableAdapterCount: 2,
          vendorableAdapterNames: ["iflytek/skillhub", "Panniantong/Agent-Reach"],
          version: 1,
        },
      },
      treasury: {
        reserveFloorSol: 0.6942,
        reserveSol: 0.9,
      },
    });

    const response = await GET();
    const payload = (await response.json()) as {
      tooling?: {
        skillHub?: {
          available?: boolean;
          vendorableAdapterNames?: string[];
        };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.tooling?.skillHub?.available).toBe(true);
    expect(payload.tooling?.skillHub?.vendorableAdapterNames).toEqual([
      "iflytek/skillhub",
      "Panniantong/Agent-Reach",
    ]);
  });
});
