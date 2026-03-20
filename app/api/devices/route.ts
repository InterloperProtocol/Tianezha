import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { encryptJson } from "@/lib/server/crypto";
import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import { listDevices, upsertDevice } from "@/lib/server/repository";
import { DeviceCredentials, DeviceProfile, DeviceType } from "@/lib/types";
import { nowIso } from "@/lib/utils";

function supports(type: DeviceType) {
  switch (type) {
    case "autoblow":
    case "handy":
      return { supportsLive: true, supportsScript: true };
    case "rest":
      return { supportsLive: true, supportsScript: false };
    default:
      return { supportsLive: false, supportsScript: false };
  }
}

export async function GET() {
  try {
    const session = await getOrCreateGuestSession();
    await assertGuestEnabled(session.id);
    const devices = await listDevices(session.id);
    return NextResponse.json({ items: devices });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load devices",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getOrCreateGuestSession();
    await assertGuestEnabled(session.id);

    const body = (await request.json()) as {
      type?: DeviceType;
      label?: string;
      credentials?: DeviceCredentials;
    };

    if (!body.type || !body.label || !body.credentials) {
      return NextResponse.json(
        { error: "type, label, and credentials are required" },
        { status: 400 },
      );
    }

    const profile: DeviceProfile = {
      id: randomUUID(),
      wallet: session.id,
      type: body.type,
      label: body.label,
      encryptedCredentials: encryptJson(body.credentials),
      ...supports(body.type),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const saved = await upsertDevice(profile);
    return NextResponse.json({ item: saved });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save device",
      },
      { status: 500 },
    );
  }
}
