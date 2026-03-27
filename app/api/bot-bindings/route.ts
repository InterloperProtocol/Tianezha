import { NextResponse } from "next/server";

import {
  getCurrentLoadedIdentity,
  upsertBotBindingForCurrentLoadedIdentity,
} from "@/lib/server/tianezha-simulation";

export async function GET() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  return NextResponse.json({
    botBindings: loadedIdentity?.botBindings ?? [],
    profileId: loadedIdentity?.profile.id ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      displayName?: string;
      externalUserId?: string;
      platform?: "telegram" | "wechat";
    };

    if (payload.platform !== "telegram" && payload.platform !== "wechat") {
      return NextResponse.json(
        { error: "platform must be telegram or wechat." },
        { status: 400 },
      );
    }

    if (!payload.externalUserId?.trim()) {
      return NextResponse.json(
        { error: "externalUserId is required." },
        { status: 400 },
      );
    }

    const binding = await upsertBotBindingForCurrentLoadedIdentity({
      displayName: payload.displayName,
      externalUserId: payload.externalUserId,
      platform: payload.platform,
    });

    return NextResponse.json({ binding });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update bot bindings.";
    return NextResponse.json(
      {
        error: message,
      },
      {
        status: message.includes("Load a Tianezha profile") ? 400 : 500,
      },
    );
  }
}
