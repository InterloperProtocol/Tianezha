import { NextResponse } from "next/server";

import { getGuestSession } from "@/lib/server/guest";
import { getLivestreamState } from "@/lib/server/livestream";

export async function GET() {
  try {
    const guestSession = await getGuestSession();
    const state = await getLivestreamState(guestSession?.id || null);
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load livestream status",
      },
      { status: 500 },
    );
  }
}
