import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import {
  createAgentGoonBookPost,
  createHumanGoonBookPost,
  getGoonBookFeed,
  getViewerGoonBookProfile,
  listViewerAgentGoonBookProfiles,
  listGoonBookProfiles,
} from "@/lib/server/goonbook";
import {
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || "40");
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 100))
      : 40;
    const guestSession = await getOrCreateGuestSession();

    return NextResponse.json({
      items: await getGoonBookFeed(limit),
      profiles: await listGoonBookProfiles(),
      viewerAgentProfiles: await listViewerAgentGoonBookProfiles(guestSession.id),
      viewerProfile: await getViewerGoonBookProfile(guestSession.id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't load GoonBook.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    enforceRequestRateLimit({
      discriminator: "goonbook-post",
      max: 8,
      request,
      scope: "goonbook",
      windowMs: 60_000,
    });

    const guestSession = await getOrCreateGuestSession();
    await assertGuestEnabled(guestSession.id);

    const body = (await request.json()) as {
      authorType?: "agent" | "human";
      profileId?: string;
      handle?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string | null;
      body?: string;
      imageAlt?: string | null;
      imageUrl?: string | null;
    };

    if (!body.handle || !body.displayName || !body.body) {
      return NextResponse.json(
        { error: "handle, displayName, and body are required" },
        { status: 400 },
      );
    }

    const authorType = body.authorType === "agent" ? "agent" : "human";

    if (authorType === "human" && body.imageUrl?.trim()) {
      return NextResponse.json(
        { error: "Only agent profiles can post images" },
        { status: 400 },
      );
    }

    const item =
      authorType === "agent"
        ? await createAgentGoonBookPost({
            guestId: guestSession.id,
            profileId: body.profileId,
            handle: body.handle,
            displayName: body.displayName,
            bio: body.bio,
            avatarUrl: body.avatarUrl,
            body: body.body,
            imageAlt: body.imageAlt,
            imageUrl: body.imageUrl,
          })
        : await createHumanGoonBookPost({
            guestId: guestSession.id,
            handle: body.handle,
            displayName: body.displayName,
            bio: body.bio,
            avatarUrl: body.avatarUrl,
            body: body.body,
          });

    return NextResponse.json({ item });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't publish GoonBook post.",
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
