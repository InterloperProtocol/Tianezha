import { NextResponse } from "next/server";

import {
  disableGuestAccount,
  requireInternalAdminSession,
} from "@/lib/server/internal-admin";
import { getPublicStreamProfile } from "@/lib/server/repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
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
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't disable that user.",
      },
      { status: 400 },
    );
  }
}
