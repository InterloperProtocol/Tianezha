import { NextResponse } from "next/server";

import {
  disableGuestAccount,
  requireInternalAdminSession,
} from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";
import { getPublicStreamProfile } from "@/lib/server/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    const admin = await requireInternalAdminSession();
    const { guestId } = await params;
    const profile = await getPublicStreamProfile(guestId);

    const item = await disableGuestAccount({
      adminUsername: admin.username,
      guestId,
      reason: "Disabled from the hidden admin dashboard.",
      slug: profile?.slug,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn't disable that user.";
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
