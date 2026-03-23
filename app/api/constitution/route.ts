import { NextResponse } from "next/server";

import { PUBLIC_CONSTITUTION_STATE, PUBLIC_BRAIN_STATE } from "@/lib/constitution";

export async function GET() {
  try {
    return NextResponse.json({
      ...PUBLIC_CONSTITUTION_STATE,
      brainState: PUBLIC_BRAIN_STATE,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load constitution state.",
      },
      { status: 500 },
    );
  }
}
