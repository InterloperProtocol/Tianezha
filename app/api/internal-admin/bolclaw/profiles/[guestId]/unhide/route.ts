import { NextResponse } from "next/server";

import {
  requireInternalAdminSession,
  unhidePublicStreamProfile,
} from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    await requireInternalAdminSession();
    const { guestId } = await params;
    const item = await unhidePublicStreamProfile({ guestId });
    return NextResponse.json({ item });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't unhide that BolClaw profile.";
    const status =
      message === "Admin authentication required"
        ? 401
        : message.includes("Cross-")
          ? 403
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
