import { NextResponse } from "next/server";

import { registerBitClawAgent } from "@/lib/server/bitclaw";
import {
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    enforceRequestRateLimit({
      discriminator: "bitclaw-agent-register",
      max: 5,
      request,
      scope: "bitclaw-agent-register",
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      handle?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string | null;
    };

    if (!body.handle || !body.displayName) {
      return NextResponse.json(
        { error: "handle and displayName are required" },
        { status: 400 },
      );
    }

    const registration = await registerBitClawAgent({
      handle: body.handle,
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
    });

    return NextResponse.json({
      agent: {
        apiKey: registration.apiKey,
        profile: registration.profile,
      },
      important: "Save your API key now. BitClaw does not show the full key again.",
      baseUrl: "/api/bitclaw/agents",
    });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't register that BitClaw agent.",
      },
      {
        headers: retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
        status: retryAfterSeconds ? 429 : 400,
      },
    );
  }
}
