import { NextResponse } from "next/server";

import { hideGoonBookPost } from "@/lib/server/goonbook";
import { requireInternalAdminSession } from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    const admin = await requireInternalAdminSession();
    const { postId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      reason?: string | null;
    };

    const item = await hideGoonBookPost({
      adminUsername: admin.username,
      postId,
      reason: body.reason,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn't hide that BitClaw post.";
    const status =
      message === "Admin authentication required"
        ? 401
        : message.includes("Cross-")
          ? 403
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
