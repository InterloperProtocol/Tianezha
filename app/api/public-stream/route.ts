import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import {
  buildPublicStreamPath,
  getCurrentPublicStreamProfile,
  saveCurrentPublicStreamProfile,
} from "@/lib/server/public-streams";

export async function GET(request: Request) {
  try {
    const guestSession = await getOrCreateGuestSession();
    const item = await getCurrentPublicStreamProfile(guestSession.id);
    const origin = new URL(request.url).origin;

    return NextResponse.json({
      item,
      publicUrl: item ? `${origin}${buildPublicStreamPath(item.slug)}` : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load public stream settings",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const guestSession = await getOrCreateGuestSession();
    const body = (await request.json()) as {
      slug?: string;
      isPublic?: boolean;
      defaultContractAddress?: string;
      mediaUrl?: string;
    };

    if (!body.slug || typeof body.isPublic !== "boolean") {
      return NextResponse.json(
        { error: "slug and isPublic are required" },
        { status: 400 },
      );
    }

    const item = await saveCurrentPublicStreamProfile(guestSession.id, {
      slug: body.slug,
      isPublic: body.isPublic,
      defaultContractAddress: body.defaultContractAddress || "",
      mediaUrl: body.mediaUrl || "",
    });
    const origin = new URL(request.url).origin;

    return NextResponse.json({
      item,
      publicUrl: `${origin}${buildPublicStreamPath(item.slug)}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save public stream settings",
      },
      { status: 400 },
    );
  }
}
