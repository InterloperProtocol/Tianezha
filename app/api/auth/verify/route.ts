import { NextResponse } from "next/server";

import {
  consumeAuthChallenge,
  createWalletSession,
  verifyWalletSignature,
} from "@/lib/server/auth";
import {
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    await enforceRequestRateLimit({
      discriminator: "wallet-verify",
      max: 10,
      request,
      scope: "wallet-auth",
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      wallet?: string;
      signature?: string;
      message?: string;
    };

    if (!body.wallet || !body.signature || !body.message) {
      return NextResponse.json(
        { error: "wallet, message, and signature are required" },
        { status: 400 },
      );
    }

    const challenge = await consumeAuthChallenge(body.wallet).catch((error: Error) => {
      throw new Error(error.message);
    });

    if (challenge.message !== body.message) {
      return NextResponse.json({ error: "Signed message mismatch" }, { status: 400 });
    }

    const valid = verifyWalletSignature(body.wallet, body.message, body.signature);
    if (!valid) {
      return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });
    }

    const session = await createWalletSession(body.wallet);
    return NextResponse.json({
      ok: true,
      wallet: session.wallet,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Wallet verification failed",
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
