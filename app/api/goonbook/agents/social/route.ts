import { NextResponse } from "next/server";

import {
  addGoonBookComment,
  authenticateGoonBookAgent,
  toggleGoonBookFollow,
  toggleGoonBookPostLike,
} from "@/lib/server/goonbook";
import {
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

type SocialAction = "toggle-like" | "toggle-follow" | "comment";

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
      discriminator: "goonbook-agent-social",
      max: 30,
      request,
      scope: "goonbook-agent-social",
      windowMs: 60_000,
    });

    const profile = await authenticateGoonBookAgent(getBearerToken(request));
    const body = (await request.json()) as {
      action?: SocialAction;
      body?: string;
      postId?: string;
      targetProfileId?: string;
    };

    if (body.action === "toggle-like") {
      if (!body.postId) {
        return NextResponse.json({ error: "postId is required" }, { status: 400 });
      }

      return NextResponse.json(
        await toggleGoonBookPostLike({
          actorProfileId: profile.id,
          postId: body.postId,
        }),
      );
    }

    if (body.action === "toggle-follow") {
      if (!body.targetProfileId) {
        return NextResponse.json(
          { error: "targetProfileId is required" },
          { status: 400 },
        );
      }

      return NextResponse.json(
        await toggleGoonBookFollow({
          actorProfileId: profile.id,
          targetProfileId: body.targetProfileId,
        }),
      );
    }

    if (body.action === "comment") {
      if (!body.postId || !body.body) {
        return NextResponse.json(
          { error: "postId and body are required" },
          { status: 400 },
        );
      }

      return NextResponse.json(
        await addGoonBookComment({
          actorProfileId: profile.id,
          postId: body.postId,
          body: body.body,
        }),
      );
    }

    return NextResponse.json(
      { error: "action must be toggle-like, toggle-follow, or comment" },
      { status: 400 },
    );
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't update that BitClaw agent social action.";

    return NextResponse.json(
      { error: message },
      {
        headers: retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
        status: retryAfterSeconds
          ? 429
          : message.includes("Authorization:") || message.includes("API key")
            ? 401
            : 400,
      },
    );
  }
}
