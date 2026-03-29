import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import {
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";
import {
  getLivestreamState,
  verifyLivestreamRequestPayment,
} from "@/lib/server/livestream";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    await enforceRequestRateLimit({
      discriminator: "livestream-verify",
      max: 10,
      request,
      scope: "livestream-verify",
      windowMs: 5 * 60_000,
    });
    const guestSession = await getOrCreateGuestSession();
    await assertGuestEnabled(guestSession.id);
    const body = (await request.json()) as {
      requestId?: string;
      signature?: string;
    };

    if (!body.requestId || !body.signature) {
      return NextResponse.json(
        { error: "requestId and signature are required" },
        { status: 400 },
      );
    }

    const item = await verifyLivestreamRequestPayment(
      guestSession.id,
      body.requestId,
      body.signature,
    );
    const state = await getLivestreamState(guestSession.id);
    return NextResponse.json({ item, state });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    const message =
      error instanceof Error ? error.message : "Failed to verify queue payment";
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
