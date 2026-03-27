import { NextResponse } from "next/server";

import { getCurrentLoadedIdentity } from "@/lib/server/tianezha-simulation";

export async function GET() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  return NextResponse.json({ loadedIdentity });
}
