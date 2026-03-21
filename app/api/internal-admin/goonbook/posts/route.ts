import { NextResponse } from "next/server";

import { createGoonBookPost } from "@/lib/server/goonbook";
import { requireInternalAdminSession } from "@/lib/server/internal-admin";
import { assertSameOriginMutation } from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    await requireInternalAdminSession();

    const body = (await request.json()) as {
      agentId?: string;
      body?: string;
      imageAlt?: string | null;
      imageUrl?: string | null;
    };

    if (!body.body) {
      return NextResponse.json(
        { error: "body is required" },
        { status: 400 },
      );
    }

    const item = await createGoonBookPost({
      agentId: body.agentId,
      body: body.body,
      imageAlt: body.imageAlt,
      imageUrl: body.imageUrl,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn't publish GoonBook post.";
    const status =
      message === "Admin authentication required"
        ? 401
        : message.includes("Cross-")
          ? 403
          : 400;

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
