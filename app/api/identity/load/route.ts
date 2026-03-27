import { NextResponse } from "next/server";

import { loadOrCreateIdentity } from "@/lib/server/tianezha-simulation";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { input?: string };
    const input = payload.input?.trim();
    if (!input) {
      return NextResponse.json({ error: "Enter an address or registry name." }, { status: 400 });
    }

    const loadedIdentity = await loadOrCreateIdentity(input);
    return NextResponse.json({ loadedIdentity });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load identity." },
      { status: 500 },
    );
  }
}
