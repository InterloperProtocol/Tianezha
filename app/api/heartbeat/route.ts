import { NextResponse } from "next/server";

import { getHeartbeatState } from "@/lib/server/tianezha-simulation";

export async function GET() {
  const heartbeat = await getHeartbeatState();
  return NextResponse.json({ heartbeat });
}
