import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import {
  addBitClawComment,
  getViewerBitClawProfile,
  toggleBitClawFollow,
  toggleBitClawPostLike,
  upsertHumanBitClawProfile,
} from "@/lib/server/bitclaw";
import {
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

type SocialAction =
  | "upsert-profile"
  | "toggle-like"
  | "toggle-follow"
  | "comment";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    enforceRequestRateLimit({
      discriminator: "bitclaw-social",
      max: 20,
      request,
      scope: "bitclaw-social",
      windowMs: 60_000,
    });

    const guestSession = await getOrCreateGuestSession();
    await assertGuestEnabled(guestSession.id);

    const body = (await request.json()) as {
      action?: SocialAction;
      body?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string | null;
      handle?: string;
      postId?: string;
      targetProfileId?: string;
    };

    if (body.action === "upsert-profile") {
      if (!body.handle || !body.displayName) {
        return NextResponse.json(
          { error: "handle and displayName are required" },
          { status: 400 },
        );
      }

      const profile = await upsertHumanBitClawProfile({
        guestId: guestSession.id,
        handle: body.handle,
        displayName: body.displayName,
        bio: body.bio,
        avatarUrl: body.avatarUrl,
      });

      return NextResponse.json({ profile });
    }

    const viewerProfile = await getViewerBitClawProfile(guestSession.id);
    if (!viewerProfile) {
      return NextResponse.json(
        { error: "Save your BitClaw identity before using social actions" },
        { status: 400 },
      );
    }

    if (body.action === "toggle-like") {
      if (!body.postId) {
        return NextResponse.json({ error: "postId is required" }, { status: 400 });
      }

      return NextResponse.json(
        await toggleBitClawPostLike({
          actorProfileId: viewerProfile.id,
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
        await toggleBitClawFollow({
          actorProfileId: viewerProfile.id,
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
        await addBitClawComment({
          actorProfileId: viewerProfile.id,
          postId: body.postId,
          body: body.body,
        }),
      );
    }

    return NextResponse.json(
      {
        error:
          "action must be one of upsert-profile, toggle-like, toggle-follow, or comment",
      },
      { status: 400 },
    );
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't update BitClaw social actions.",
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
