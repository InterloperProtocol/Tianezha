import { NextRequest, NextResponse } from "next/server";

import { decryptJson } from "@/lib/server/crypto";
import { createRuntimeAdapter } from "@/lib/server/devices";
import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import { getDevice } from "@/lib/server/repository";
import { DeviceCredentials } from "@/lib/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const session = await getOrCreateGuestSession();
  const denied = await assertGuestEnabled(session.id)
    .then(() => null)
    .catch((error) =>
      NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "This user has been disabled by the admin.",
        },
        { status: 403 },
      ),
    );
  if (denied) return denied;

  const { deviceId } = await params;
  const device = await getDevice(session.id, deviceId);
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  try {
    const adapter = createRuntimeAdapter(
      device,
      decryptJson<DeviceCredentials>(device.encryptedCredentials),
    );
    await adapter.connect();
    const status = await adapter.getStatus();
    await adapter.stop();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Device test failed" },
      { status: 400 },
    );
  }
}
