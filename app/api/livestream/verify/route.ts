import { NextResponse } from "next/server";

import { requireInternalAdminSession } from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";
import {
  getLivestreamState,
  verifyLivestreamRequestPayment,
} from "@/lib/server/livestream";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const admin = await requireInternalAdminSession();
    const body = (await request.json()) as {
      requestId?: string;
      signature?: string;
    };

    if (!body.requestId || !body.signature) {
      return NextResponse.json(
        { error: "requestId and signature are required" },
        { status: 400 },
      );
    }

    const item = await verifyLivestreamRequestPayment(
      admin.id,
      body.requestId,
      body.signature,
    );
    const state = await getLivestreamState();
    return NextResponse.json({ item, state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify queue payment";
    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          message.includes("Admin authentication required") ||
          message.includes("Cross-")
            ? 403
            : 400,
      },
    );
  }
}
