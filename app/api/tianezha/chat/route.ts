import { NextResponse } from "next/server";

import { buildTianezhaChatReply } from "@/lib/server/tianezha-simulation";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { message?: string };
    const message = payload.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "Enter a message." }, { status: 400 });
    }

    const reply = await buildTianezhaChatReply(message);
    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to answer right now." },
      { status: 500 },
    );
  }
}
