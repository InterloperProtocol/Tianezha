import { NextResponse } from "next/server";

import { PUBLIC_CHILD_BRAINS } from "@/lib/brains/registry";
import { CHILD_EXECUTION_RULE } from "@/lib/types/brains";

export async function GET() {
  try {
    return NextResponse.json({
      parentBrainId: "tianshi",
      rule: CHILD_EXECUTION_RULE,
      count: PUBLIC_CHILD_BRAINS.length,
      brains: PUBLIC_CHILD_BRAINS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load child brain registry.",
      },
      { status: 500 },
    );
  }
}
