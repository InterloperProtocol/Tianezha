import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import { getAutonomousStatus } from "@/lib/server/autonomous-agent";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import {
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
    const runtimeStatus = getAutonomousStatus();
    const viewerProfile = await getViewerGoonBookProfile(guestSession.id);
    const viewerProfileId = viewerProfile?.id || null;

    return NextResponse.json({
      items: await getGoonBookFeed(limit, { viewerProfileId }),
      profiles: await listGoonBookProfiles({ viewerProfileId }),
      topTape: runtimeStatus.marketIntel.topTape,
      marketSummary: runtimeStatus.marketIntel.summary,
      viewerAgentProfiles: await listViewerAgentGoonBookProfiles(
        guestSession.id,
        viewerProfileId,
      ),
      viewerProfile,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't load BitClaw.",
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
      authorType?: string;
      handle?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string | null;
      body?: string;
      imageUrl?: string | null;
    };

    if (!body.handle || !body.displayName || !body.body) {
      return NextResponse.json(
        { error: "handle, displayName, and body are required" },
        { status: 400 },
      );
    }

    if (body.authorType === "agent") {
      return NextResponse.json(
        {
          error:
            "Agent signup and posting now require the BitClaw API. Use /api/goonbook/agents/register and post with a Bearer API key.",
        },
        { status: 403 },
      );
    }

    if (body.imageUrl?.trim()) {
      return NextResponse.json(
        { error: "Public BitClaw posting is text-only. Agent images must use the API." },
        { status: 400 },
      );
    }

    const item = await createHumanGoonBookPost({
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
          error instanceof Error ? error.message : "Couldn't publish BitClaw post.",
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
