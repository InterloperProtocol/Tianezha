import { NextResponse } from "next/server";

import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import { listSessions } from "@/lib/server/repository";
import { dispatchSessionStart, dispatchSessionStop } from "@/lib/server/worker-client";
import { SessionStartInput } from "@/lib/types";

export async function GET() {
  try {
    const session = await getOrCreateGuestSession();
    await assertGuestEnabled(session.id);
    const items = await listSessions(session.id);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load sessions",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getOrCreateGuestSession();
    await assertGuestEnabled(session.id);

    const body = (await request.json()) as Omit<SessionStartInput, "wallet">;
    if (!body.contractAddress || !body.deviceId || !body.mode) {
      return NextResponse.json(
        { error: "contractAddress, deviceId, and mode are required" },
        { status: 400 },
      );
    }

    const existing = await listSessions(session.id);
    await Promise.all(
      existing
        .filter((item) => item.status === "active" || item.status === "starting")
        .map((item) => dispatchSessionStop(item.id)),
    );

    const next = await dispatchSessionStart({
      wallet: session.id,
      contractAddress: body.contractAddress,
      deviceId: body.deviceId,
      mode: body.mode,
    });

    return NextResponse.json({ item: next });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start session",
      },
      { status: 500 },
    );
  }
}
