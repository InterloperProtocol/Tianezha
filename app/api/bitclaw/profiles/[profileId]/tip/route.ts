import { NextResponse } from "next/server";

import {
  createAgentTipCommitment,
  getCurrentLoadedIdentity,
} from "@/lib/server/tianezha-simulation";
import type { AgentTipCommitment } from "@/lib/simulation/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await context.params;
    const payload = (await request.json()) as {
      amount?: number;
      chain?: AgentTipCommitment["fundingChain"];
      symbol?: string;
    };

    const loadedIdentity = await getCurrentLoadedIdentity();
    if (!loadedIdentity) {
      return NextResponse.json(
        { error: "Load a profile before sponsoring an agent." },
        { status: 400 },
      );
    }

    const commitment = await createAgentTipCommitment({
      amount: Math.max(1, Number(payload.amount ?? 25)),
      fundingChain: payload.chain ?? "solana",
      fundingSymbol: payload.symbol?.trim() || "$CAMIUP",
      profileId,
      tipperProfileId: loadedIdentity.profile.id,
    });

    return NextResponse.json({ commitment });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the agent sponsorship commitment.",
      },
      { status: 500 },
    );
  }
}

