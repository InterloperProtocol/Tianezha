import { NextResponse } from "next/server";

import { requireInternalAdminSession } from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";
import { applySupportVerificationOverride } from "@/lib/server/tianezha-simulation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    await requireInternalAdminSession();
    const { profileId } = await params;
    const rewardUnlock = await applySupportVerificationOverride(profileId);

    return NextResponse.json({ rewardUnlock });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to apply the support verification override.";
    const status =
      message === "Admin authentication required"
        ? 401
        : message.includes("Cross-")
          ? 403
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
