import { NextResponse } from "next/server";

import {
  createHolderDeployedAgent,
  getHolderAgentCockpitState,
} from "@/lib/server/tianezha-simulation";

export async function GET() {
  const cockpit = await getHolderAgentCockpitState();
  return NextResponse.json(cockpit);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      displayName?: string;
      strategySummary?: string | null;
    };
    const cockpit = await getHolderAgentCockpitState();
    if (!cockpit.loadedIdentity) {
      return NextResponse.json(
        { error: "Load a verified profile before deploying a holder agent." },
        { status: 400 },
      );
    }

    const deployment = await createHolderDeployedAgent({
      displayName: payload.displayName?.trim() || "",
      profileId: cockpit.loadedIdentity.profile.id,
      strategySummary: payload.strategySummary?.trim() || null,
    });

    return NextResponse.json({
      cockpit: await getHolderAgentCockpitState(cockpit.loadedIdentity.profile.id),
      deployment,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to deploy the holder agent.",
      },
      { status: 400 },
    );
  }
}
