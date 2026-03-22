import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";
import { createLivestreamRequest, getLivestreamState } from "@/lib/server/livestream";
import { LivestreamTier } from "@/lib/types";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const guestSession = await getOrCreateGuestSession();
    await assertGuestEnabled(guestSession.id);

    const body = (await request.json()) as {
      contractAddress?: string;
      tier?: LivestreamTier;
    };

    if (!body.contractAddress || !body.tier) {
      return NextResponse.json(
        { error: "contractAddress and tier are required" },
        { status: 400 },
      );
    }

    if (body.tier !== "standard" && body.tier !== "priority") {
      return NextResponse.json(
        { error: "tier must be standard or priority" },
        { status: 400 },
      );
    }

    const contractAddress = body.contractAddress as string;
    const tier = body.tier as LivestreamTier;
    const item = await createLivestreamRequest(
      guestSession.id,
      contractAddress,
      tier,
    );
    const state = await getLivestreamState(guestSession.id);
    return NextResponse.json({ item, state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create queue request";
    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          message.includes("Authentication required") || message.includes("Cross-")
            ? 403
            : 400,
      },
    );
  }
}
