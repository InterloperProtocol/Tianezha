import { NextResponse } from "next/server";

import {
  CONSTITUTION,
  PUBLIC_BRAIN_STATE,
  PUBLIC_CONSTITUTION_STATE,
  PUBLIC_ECONOMIC_STATE,
  getTreasuryPosture,
  solToLamports,
} from "@/lib/constitution";
import { getAutonomousStatusWithLiveReserve } from "@/lib/server/autonomous-agent";

export async function GET() {
  try {
    const status = await getAutonomousStatusWithLiveReserve();
    const liveReserveLamports = solToLamports(status.treasury.reserveSol.toString());
    const treasuryPosture = getTreasuryPosture({
      currentTreasuryLamports: liveReserveLamports,
    });

    return NextResponse.json({
      ...status,
      reserveFloor: PUBLIC_ECONOMIC_STATE.reserve,
      billboardPrice: PUBLIC_ECONOMIC_STATE.billboard,
      creatorFeePolicy: PUBLIC_ECONOMIC_STATE.creatorFees,
      tradingProfitPolicy: PUBLIC_ECONOMIC_STATE.tradingProfitAboveReserve,
      governanceMode: CONSTITUTION.governancePolicy.profitBranch.defaultMode,
      circuitBreakerState:
        status.circuitBreakerState || status.control?.circuitBreakerState,
      parentBrain: PUBLIC_BRAIN_STATE.parentBrain,
      childBrainCount: PUBLIC_BRAIN_STATE.childBrainCount,
      childBrainIds: PUBLIC_BRAIN_STATE.childBrainIds,
      socialCapitalMode: {
        goal: CONSTITUTION.socialCapitalPolicy.goal,
        channels: CONSTITUTION.socialCapitalPolicy.channels,
        publishIsTreasuryGrowth:
          CONSTITUTION.socialCapitalPolicy.publishIsTreasuryGrowth,
      },
      financialCapitalMode: {
        reserveHealthy: treasuryPosture.reserveHealthy,
        availableAboveReserveLamports:
          treasuryPosture.availableAboveReserveLamports,
        creatorFeesRouteToParent: true,
        governanceZone: "profit_above_reserve",
      },
      constitution: PUBLIC_CONSTITUTION_STATE,
      economics: PUBLIC_ECONOMIC_STATE,
      brains: PUBLIC_BRAIN_STATE,
      treasuryPosture,
      heartBeat: {
        constitutionRoute: "/api/constitution",
        brainsRoute: "/api/brains",
        route: "/api/agent/status",
        surfaceName: "HeartBeat",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load autonomous agent status.",
      },
      { status: 500 },
    );
  }
}
