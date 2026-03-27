import { NextResponse } from "next/server";

import {
  createAgentTradeRequest,
  getAgentTradeRequestState,
  getCurrentLoadedIdentity,
} from "@/lib/server/tianezha-simulation";
import type { AgentTradeRequestKind } from "@/lib/simulation/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await context.params;
  const state = await getAgentTradeRequestState(profileId);
  if (!state) {
    return NextResponse.json({ error: "Agent profile not found." }, { status: 404 });
  }

  return NextResponse.json(state);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await context.params;
    const payload = (await request.json()) as {
      body?: string;
      kind?: AgentTradeRequestKind;
      sourceUrl?: string;
      title?: string;
    };

    const loadedIdentity = await getCurrentLoadedIdentity();
    const record = await createAgentTradeRequest({
      body: payload.body?.trim() || "",
      kind: payload.kind === "prediction-market" ? "prediction-market" : "paste-trade",
      profileId,
      requesterProfileId: loadedIdentity?.profile.id ?? null,
      sourceUrl: payload.sourceUrl?.trim() || null,
      title: payload.title?.trim() || "",
    });

    return NextResponse.json({
      request: record,
      state: await getAgentTradeRequestState(profileId),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save that agent trade request.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
