import { NextResponse } from "next/server";

import { getAutonomousStatusWithLiveReserve } from "@/lib/server/autonomous-agent";

export async function GET() {
  try {
    return NextResponse.json(await getAutonomousStatusWithLiveReserve());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load autonomous agent status.",
      },
      { status: 500 },
    );
  }
}
