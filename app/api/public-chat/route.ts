import { NextResponse } from "next/server";

import {
  generatePublicChatReply,
  reservePublicChatTurn,
  sanitizePublicChatMessages,
} from "@/lib/server/public-chat";
import {
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

export async function POST(request: Request) {
  try {
    await enforceRequestRateLimit({
      discriminator: "public-chat",
      max: 12,
      request,
      scope: "public-chat",
      windowMs: 5 * 60_000,
    });

    const payload = (await request.json()) as {
      messages?: Array<{ role?: string; content?: string }>;
    };

    const usage = await reservePublicChatTurn();
    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: "Daily message cap reached. Try again after the reset window.",
          remainingMessages: usage.remainingMessages,
          resetAt: usage.resetAt,
        },
        { status: 429 },
      );
    }

    const reply = await generatePublicChatReply(
      sanitizePublicChatMessages(
        (payload.messages || []).map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: typeof message.content === "string" ? message.content : "",
        })),
      ),
    );

    return NextResponse.json({
      reply,
      remainingMessages: usage.remainingMessages,
      resetAt: usage.resetAt,
    });
  } catch (error) {
    const retryAfterSeconds = getRateLimitRetryAfterSeconds(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The chat could not answer right now.",
      },
      {
        headers: retryAfterSeconds
          ? { "Retry-After": String(retryAfterSeconds) }
          : undefined,
        status: retryAfterSeconds ? 429 : 400,
      },
    );
  }
}
