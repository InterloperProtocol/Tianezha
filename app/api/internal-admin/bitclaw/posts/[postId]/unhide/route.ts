import { NextResponse } from "next/server";

import { requireInternalAdminSession } from "@/lib/server/internal-admin";
import { unhideBitClawPost } from "@/lib/server/bitclaw";
import { assertSameOriginMutation } from "@/lib/server/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    await requireInternalAdminSession();
    const { postId } = await params;
    const item = await unhideBitClawPost({ postId });
    return NextResponse.json({ item });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't unhide that BitClaw post.";
    const status =
      message === "Admin authentication required"
        ? 401
        : message.includes("Cross-")
          ? 403
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
