import { NextRequest, NextResponse } from "next/server";

import { resolveMediaSource } from "@/lib/server/media";
import { assertSafeExternalHttpUrl } from "@/lib/server/request-security";

function normalizeParentHost(rawValue?: string | null) {
  const trimmed = rawValue?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (
    trimmed.length > 255 ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#")
  ) {
    return null;
  }

  const withoutPort = trimmed.replace(/:\d+$/, "");
  return /^(localhost|[a-z0-9-]+(\.[a-z0-9-]+)*)$/.test(withoutPort)
    ? withoutPort
    : null;
}

function getResolvedParentHost(request: NextRequest) {
  const queryHost = normalizeParentHost(request.nextUrl.searchParams.get("parentHost"));
  if (queryHost) {
    return queryHost;
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  return (
    normalizeParentHost(forwardedHost) ||
    normalizeParentHost(request.nextUrl.hostname) ||
    "localhost"
  );
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
