import { NextResponse } from "next/server";

import {
  getInternalAdminDashboardData,
  getInternalAdminSession,
} from "@/lib/server/internal-admin";

export async function GET() {
  try {
    const currentAdmin = await getInternalAdminSession();
    if (!currentAdmin) {
      return NextResponse.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const data = await getInternalAdminDashboardData();
    return NextResponse.json({
      ...data,
      currentAdmin,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load the hidden admin dashboard.",
      },
      { status: 500 },
    );
  }
}
