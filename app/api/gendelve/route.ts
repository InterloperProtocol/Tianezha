import { NextResponse } from "next/server";

import {
  createGenDelveVoteIntent,
  createProfileOwnerChallenge,
  getCurrentLoadedIdentity,
  getGenDelveState,
  verifyCamiupHolderTransfer,
  verifyGenDelveVoteIntent,
  verifyProfileOwnerChallenge,
} from "@/lib/server/tianezha-simulation";

export async function GET() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  const gendelve = await getGenDelveState(loadedIdentity?.profile.id);
  return NextResponse.json({ gendelve });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      action?:
        | "createVote"
        | "verifyVote"
        | "createChallenge"
        | "verifyChallenge"
        | "verifyHolder";
      choice?: "support" | "oppose";
      intentId?: string;
      transactionId?: string;
      worldId?: string;
    };
    const loadedIdentity = await getCurrentLoadedIdentity();
    if (!loadedIdentity) {
      return NextResponse.json({ error: "Load a profile before using GenDelve." }, { status: 400 });
    }

    if (payload.action === "createVote") {
      if (!payload.worldId || !payload.choice) {
        return NextResponse.json({ error: "worldId and choice are required." }, { status: 400 });
      }

      const intent = await createGenDelveVoteIntent({
        choice: payload.choice,
        profileId: loadedIdentity.profile.id,
        worldId: payload.worldId,
      });
      return NextResponse.json({ intent });
    }

    if (payload.action === "verifyVote") {
      if (!payload.intentId || !payload.transactionId?.trim()) {
        return NextResponse.json(
          { error: "intentId and transactionId are required." },
          { status: 400 },
        );
      }

      const intent = await verifyGenDelveVoteIntent(
        payload.intentId,
        payload.transactionId,
      );
      return NextResponse.json({ intent });
    }

    if (payload.action === "createChallenge") {
      const challenge = await createProfileOwnerChallenge(loadedIdentity.profile.id);
      return NextResponse.json({ challenge });
    }

    if (payload.action === "verifyHolder") {
      if (!payload.worldId || !payload.transactionId?.trim()) {
        return NextResponse.json(
          { error: "worldId and transactionId are required." },
          { status: 400 },
        );
      }

      const loaded = await verifyCamiupHolderTransfer({
        profileId: loadedIdentity.profile.id,
        transactionId: payload.transactionId,
        worldId: payload.worldId,
      });
      return NextResponse.json({ loadedIdentity: loaded });
    }

    if (payload.action === "verifyChallenge") {
      if (!payload.transactionId?.trim()) {
        return NextResponse.json(
          { error: "transactionId is required." },
          { status: 400 },
        );
      }

      const rewardUnlock = await verifyProfileOwnerChallenge(
        loadedIdentity.profile.id,
        payload.transactionId,
      );
      return NextResponse.json({ rewardUnlock });
    }

    return NextResponse.json({ error: "Unknown GenDelve action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process GenDelve request." },
      { status: 500 },
    );
  }
}
