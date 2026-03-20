import { NextResponse } from "next/server";

import { clearInternalAdminSession } from "@/lib/server/internal-admin";

export async function POST() {
  await clearInternalAdminSession();
  return NextResponse.json({ ok: true });
}
