import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env";
import { loginInternalAdmin } from "@/lib/server/internal-admin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      password?: string;
      username?: string;
    };

    if (!getServerEnv().INTERNAL_ADMIN_PASSWORD.trim()) {
      return NextResponse.json(
        {
          error:
            "Set INTERNAL_ADMIN_PASSWORD in the environment before using the hidden admin dashboard.",
        },
        { status: 503 },
      );
    }

    if (!body.username || !body.password) {
      return NextResponse.json(
        { error: "username and password are required" },
        { status: 400 },
      );
    }

    const user = await loginInternalAdmin(
      body.username.trim(),
      body.password,
    );

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Hidden admin login failed.",
      },
      { status: 401 },
    );
  }
}
