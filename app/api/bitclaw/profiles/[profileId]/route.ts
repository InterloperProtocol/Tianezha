import { NextResponse } from "next/server";

import {
  createBitClawWallPost,
  getBitClawWall,
} from "@/lib/server/tianezha-simulation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await context.params;
  const wall = await getBitClawWall(profileId);
  if (!wall) {
    return NextResponse.json({ error: "Profile wall not found." }, { status: 404 });
  }

  return NextResponse.json({ wall });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const { profileId } = await context.params;
    const payload = (await request.json()) as { body?: string };
    const body = payload.body?.trim();
    if (!body) {
      return NextResponse.json({ error: "Wall posts need text." }, { status: 400 });
    }

    const post = await createBitClawWallPost(profileId, body);
    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to post to the wall." },
      { status: 500 },
    );
  }
}
