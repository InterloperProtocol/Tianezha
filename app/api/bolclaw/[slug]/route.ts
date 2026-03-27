import { NextResponse } from "next/server";

import {
  buildPublicStreamPath,
  getPublicStreamPageState,
} from "@/lib/server/public-streams";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const state = await getPublicStreamPageState(slug);
    if (!state) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      ...state,
      publicUrl: `${origin}${buildPublicStreamPath(state.profile.slug)}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load stream page",
      },
      { status: 500 },
    );
  }
}
