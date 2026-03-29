import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import {
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";
import { createLivestreamRequest, getLivestreamState } from "@/lib/server/livestream";
import { LivestreamTier } from "@/lib/types";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    await enforceRequestRateLimit({
      discriminator: "livestream-request",
      max: 6,
      request,
      scope: "livestream-request",
      windowMs: 5 * 60_000,
    });
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
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    const message =
      error instanceof Error ? error.message : "Failed to create queue request";
    return NextResponse.json(
      {
        error: message,
      },
      {
        headers: retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
        status:
          retryAfterSeconds
            ? 429
            : message.includes("Authentication required") || message.includes("Cross-")
            ? 403
            : 400,
      },
    );
  }
}
