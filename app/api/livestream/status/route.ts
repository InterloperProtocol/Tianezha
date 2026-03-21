import { NextResponse } from "next/server";

import { getLivestreamState } from "@/lib/server/livestream";

export async function GET() {
  try {
    const state = await getLivestreamState();
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
