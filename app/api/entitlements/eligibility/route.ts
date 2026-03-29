import { NextResponse } from "next/server";

import { PublicKey } from "@solana/web3.js";

import { requireWalletSession } from "@/lib/server/auth";
import { claimEligibilitySubscriptionCnft } from "@/lib/server/entitlements";
import { getEntitlement } from "@/lib/server/repository";
import {
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

function normalizeWallet(value: string) {
  return new PublicKey(value.trim()).toBase58();
}

function getStatusCode(message: string) {
  if (message.includes("not eligible")) return 403;
  if (message.includes("configured")) return 503;
  if (message.includes("Helius request failed")) return 502;
  return 400;
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    await enforceRequestRateLimit({
      discriminator: "eligibility-cnft",
      max: 5,
      request,
      scope: "entitlement-eligibility",
      windowMs: 60_000,
    });

    const session = await requireWalletSession().catch(() => null);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { wallet?: string };
    if (body.wallet?.trim()) {
      let requestedWallet: string;
      try {
        requestedWallet = normalizeWallet(body.wallet);
      } catch {
        return NextResponse.json(
          { error: "Wallet must be a valid Solana address" },
          { status: 400 },
        );
      }

      if (requestedWallet !== session.wallet) {
        return NextResponse.json(
          { error: "The requested wallet must match the authenticated wallet" },
          { status: 403 },
        );
      }
    }

    const existing = await getEntitlement(session.wallet);
    if (existing?.status === "active" || existing?.type === "cnft") {
      return NextResponse.json({
        ok: true,
        reused: true,
        entitlement: existing,
      });
    }

    const entitlement = await claimEligibilitySubscriptionCnft(session.wallet);
    return NextResponse.json({ ok: true, reused: false, entitlement });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't send the subscription pass";
    return NextResponse.json(
      { error: message },
      {
        headers: retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
        status: retryAfterSeconds
          ? 429
          : message.includes("Cross-")
            ? 403
            : getStatusCode(message),
      },
    );
  }
}
