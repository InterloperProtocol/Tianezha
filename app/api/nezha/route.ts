import { NextResponse } from "next/server";

import {
  getCurrentLoadedIdentity,
  getNezhaState,
  placePerpOrder,
} from "@/lib/server/tianezha-simulation";

export async function GET() {
  const loadedIdentity = await getCurrentLoadedIdentity();
  const nezha = await getNezhaState(loadedIdentity?.profile.id);
  return NextResponse.json({ nezha });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      leverage?: number;
      limitPrice?: number | null;
      marketId?: string;
      orderType?: "market" | "limit";
      quantity?: number;
      reduceOnly?: boolean;
      side?: "long" | "short";
    };
    const loadedIdentity = await getCurrentLoadedIdentity();
    if (!loadedIdentity) {
      return NextResponse.json({ error: "Load a profile before placing Nezha orders." }, { status: 400 });
    }

    if (!payload.marketId || !payload.orderType || !payload.quantity || !payload.side) {
      return NextResponse.json(
        { error: "marketId, orderType, quantity, and side are required." },
        { status: 400 },
      );
    }

    const order = await placePerpOrder({
      leverage: Number(payload.leverage || 1),
      limitPrice: payload.limitPrice ?? null,
      marketId: payload.marketId,
      orderType: payload.orderType,
      profileId: loadedIdentity.profile.id,
      quantity: Number(payload.quantity),
      reduceOnly: Boolean(payload.reduceOnly),
      side: payload.side,
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to place Nezha order." },
      { status: 500 },
    );
  }
}
