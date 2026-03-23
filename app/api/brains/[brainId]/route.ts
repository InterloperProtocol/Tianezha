import { NextResponse } from "next/server";

import { getPublicChildBrainSummary } from "@/lib/brains/registry";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brainId: string }> },
) {
  try {
    const { brainId } = await params;
    const brain = getPublicChildBrainSummary(brainId);

    if (!brain) {
      return NextResponse.json(
        { error: `Unknown child brain: ${brainId}` },
        { status: 404 },
      );
    }

    return NextResponse.json(brain);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load brain summary.",
      },
      { status: 500 },
    );
  }
}
