import { NextRequest, NextResponse } from "next/server";

import { resolveMediaSource } from "@/lib/server/media";
import { assertSafeExternalHttpUrl } from "@/lib/server/request-security";

function getResolvedParentHost(request: NextRequest) {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  return forwardedHost || request.nextUrl.hostname || "localhost";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";

  if (!url) {
    return NextResponse.json({ error: "Missing media URL" }, { status: 400 });
  }

  try {
    const media = await resolveMediaSource(
      await assertSafeExternalHttpUrl(url, { label: "Media URL" }),
      getResolvedParentHost(request),
    );

    if (!media) {
      return NextResponse.json(
        { error: "Could not resolve a playable or embeddable media source" },
        { status: 404 },
      );
    }

    return NextResponse.json(media);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to resolve media source",
      },
      { status: 400 },
    );
  }
}
