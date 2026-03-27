import { NextResponse } from "next/server";

import { buildPublicStreamPath, listActivePublicStreams } from "@/lib/server/public-streams";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const items = await listActivePublicStreams();

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        publicUrl: `${origin}${buildPublicStreamPath(item.profile.slug)}`,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load active BolClaw",
      },
      { status: 500 },
    );
  }
}
