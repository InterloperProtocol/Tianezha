import { NextResponse } from "next/server";

import {
  hidePublicStreamProfile,
  requireInternalAdminSession,
} from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    const admin = await requireInternalAdminSession();
    const { guestId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      reason?: string | null;
    };

    const item = await hidePublicStreamProfile({
      guestId,
      adminUsername: admin.username,
      reason: body.reason,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't hide that BolClaw profile.";
    const status =
      message === "Admin authentication required"
        ? 401
        : message.includes("Cross-")
          ? 403
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
