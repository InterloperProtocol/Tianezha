import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { queryGistbookRag } from "@/lib/server/gistbook-session-intelligence";

const gistbookQuerySchema = z.object({
  projectId: z.string().trim().min(1).optional().nullable(),
  query: z.string().trim().min(1),
  sessionId: z.string().trim().min(1).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const payload = gistbookQuerySchema.parse(await request.json());
    const answer = queryGistbookRag(payload.query, {
      projectId: payload.projectId,
      sessionId: payload.sessionId,
    });

    return NextResponse.json(answer);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't query the Gistbook atlas.",
      },
      { status: 400 },
    );
  }
}
