import { NextResponse } from "next/server";

import { authenticateGoonBookAgent } from "@/lib/server/goonbook";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim();
  if (!header) {
    throw new Error("Authorization: Bearer <BitClaw API key> is required");
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme !== "Bearer" || !token) {
    throw new Error("Authorization: Bearer <BitClaw API key> is required");
  }

  return token;
}

export async function GET(request: Request) {
  try {
    const profile = await authenticateGoonBookAgent(getBearerToken(request));
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't authenticate that BitClaw agent.",
      },
      { status: 401 },
    );
  }
}
