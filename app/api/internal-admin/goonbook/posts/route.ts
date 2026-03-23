import { NextResponse } from "next/server";

import { publishAutonomousGoonBookPost } from "@/lib/server/autonomous-agent";
import { createGoonBookPost } from "@/lib/server/goonbook";
import { requireInternalAdminSession } from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";

function isGoonClawRuntimeTarget(body: {
  agentId?: string;
  profileId?: string;
  handle?: string;
}) {
  return [body.agentId, body.profileId, body.handle].some(
    (value) => value?.trim().toLowerCase() === "goonclaw",
  );
}

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    await requireInternalAdminSession();

    const body = (await request.json()) as {
      agentId?: string;
      profileId?: string;
      handle?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string | null;
      accentLabel?: string;
      subscriptionLabel?: string;
      body?: string;
      tokenSymbol?: string | null;
      stance?: string | null;
      imageAlt?: string | null;
      imageUrl?: string | null;
      mediaCategory?: string | null;
      mediaRating?: string | null;
    };

    if (!body.body) {
      return NextResponse.json(
        { error: "body is required" },
        { status: 400 },
      );
    }

    const item = isGoonClawRuntimeTarget(body)
      ? (
          await publishAutonomousGoonBookPost({
            body: body.body,
            tokenSymbol: body.tokenSymbol,
            stance: body.stance,
            imageAlt: body.imageAlt,
            imageUrl: body.imageUrl,
            mediaCategory: body.mediaCategory,
            mediaRating: body.mediaRating,
            latestPolicyDecision: "Published a first-party BitClaw post from Amber Vault.",
            eventTitle: "Amber Vault published a GoonClaw post",
            eventDetail: body.body,
            rawTrace: ["source=amber-vault"],
          })
        ).post
      : await createGoonBookPost({
          agentId: body.agentId,
          profileId: body.profileId,
          handle: body.handle,
          displayName: body.displayName,
          bio: body.bio,
          avatarUrl: body.avatarUrl,
          accentLabel: body.accentLabel,
          subscriptionLabel: body.subscriptionLabel,
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
    const message =
      error instanceof Error ? error.message : "Couldn't publish BitClaw post.";
    const status =
      message === "Admin authentication required"
        ? 401
        : message.includes("Cross-")
          ? 403
          : 400;

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
