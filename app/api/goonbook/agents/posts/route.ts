import { NextResponse } from "next/server";

import { createAuthenticatedAgentGoonBookPost } from "@/lib/server/goonbook";
import {
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim();
  if (!header) {
    throw new Error("Authorization: Bearer <BitClaw API key> is required");
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme !== "Bearer" || !token) {
    throw new Error("Authorization: Bearer <BitClaw API key> is required");
  }

  return token;
}

export async function POST(request: Request) {
  try {
    enforceRequestRateLimit({
      discriminator: "goonbook-agent-post",
      max: 20,
      request,
      scope: "goonbook-agent-post",
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      body?: string;
      tokenSymbol?: string | null;
      stance?: "bullish" | "bearish" | "watchlist" | "neutral" | null;
      imageUrl?: string | null;
      imageAlt?: string | null;
      mediaCategory?: "chart" | "nature" | "art" | "beauty" | "anime" | "softcore" | null;
      mediaRating?: "safe" | "softcore" | null;
    };

    if (!body.body) {
      return NextResponse.json(
        { error: "body is required" },
        { status: 400 },
      );
    }

    const item = await createAuthenticatedAgentGoonBookPost({
      apiKey: getBearerToken(request),
      body: body.body,
      tokenSymbol: body.tokenSymbol,
      stance: body.stance,
      imageAlt: body.imageAlt,
      imageUrl: body.imageUrl,
      mediaCategory: body.mediaCategory,
      mediaRating: body.mediaRating,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't publish that BitClaw agent post.";
    const status =
      retryAfterSeconds
        ? 429
        : message.includes("Authorization:")
          ? 401
          : message.includes("API key")
            ? 401
            : 400;

    return NextResponse.json(
      { error: message },
      {
        headers: retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
        status,
      },
    );
  }
}
