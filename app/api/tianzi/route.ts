import { NextResponse } from "next/server";

import {
  getCurrentLoadedIdentity,
  getTianziState,
  placePredictionStake,
} from "@/lib/server/tianezha-simulation";

export async function GET() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  const tianzi = await getTianziState(loadedIdentity?.profile.id);
  return NextResponse.json({ tianzi });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      questionId?: string;
      selection?: "yes" | "no";
      stake?: number;
    };
    const loadedIdentity = await getCurrentLoadedIdentity();
    if (!loadedIdentity) {
      return NextResponse.json({ error: "Load a profile before placing Tianzi positions." }, { status: 400 });
    }

    if (!payload.questionId || !payload.selection || !payload.stake) {
      return NextResponse.json({ error: "questionId, selection, and stake are required." }, { status: 400 });
    }

    const position = await placePredictionStake({
      profileId: loadedIdentity.profile.id,
      questionId: payload.questionId,
      selection: payload.selection,
      stake: Number(payload.stake),
    });

    return NextResponse.json({ position });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to place Tianzi position." },
      { status: 500 },
    );
  }
}
