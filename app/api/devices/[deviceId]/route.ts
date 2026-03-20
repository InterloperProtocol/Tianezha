import { NextRequest, NextResponse } from "next/server";

import { encryptJson } from "@/lib/server/crypto";
import { getOrCreateGuestSession } from "@/lib/server/guest";
import { assertGuestEnabled } from "@/lib/server/internal-admin";
import { deleteDevice, getDevice, upsertDevice } from "@/lib/server/repository";
import { DeviceCredentials } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
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
  const existing = await getDevice(session.id, deviceId);
  if (!existing) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    label?: string;
    credentials?: DeviceCredentials;
  };

  const next = {
    ...existing,
    label: body.label ?? existing.label,
    encryptedCredentials: body.credentials
      ? encryptJson(body.credentials)
      : existing.encryptedCredentials,
    updatedAt: nowIso(),
  };

  const saved = await upsertDevice(next);
  return NextResponse.json({ item: saved });
}

export async function DELETE(
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
  const deleted = await deleteDevice(session.id, deviceId);
  return NextResponse.json({ ok: deleted });
}
