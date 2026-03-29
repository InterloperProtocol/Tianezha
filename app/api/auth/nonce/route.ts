import { NextRequest, NextResponse } from "next/server";

import { createAuthChallenge } from "@/lib/server/auth";
import {
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

export async function POST(request: NextRequest) {
  try {
    assertSameOriginMutation(request);
    await enforceRequestRateLimit({
      discriminator: "wallet-nonce",
      max: 8,
      request,
      scope: "wallet-auth",
      windowMs: 60_000,
    });

    const body = (await request.json()) as { wallet?: string };
    if (!body.wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    const challenge = await createAuthChallenge(body.wallet, request.nextUrl.origin);
    return NextResponse.json({
      wallet: challenge.wallet,
      message: challenge.message,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create wallet challenge",
      },
      {
        headers: retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
        status: retryAfterSeconds
          ? 429
          : error instanceof Error && error.message.includes("Cross-")
            ? 403
            : 400,
      },
    );
  }
}
