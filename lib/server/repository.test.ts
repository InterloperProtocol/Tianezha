import { beforeEach, describe, expect, it, vi } from "vitest";

const envModule = vi.hoisted(() => ({
  getServerEnv: vi.fn(() => ({
    NODE_ENV: "development",
  })),
  isFirebaseConfigured: vi.fn(() => false),
  isProductionEnv: vi.fn(() => false),
}));

vi.mock("@/lib/env", () => envModule);

import {
  getSession,
  markSessionStopped,
  upsertSession,
} from "@/lib/server/repository";
import type { SessionRecord } from "@/lib/types";

describe("markSessionStopped", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { __tianshiMemory?: unknown }).__tianshiMemory = undefined;
  });

  it("clears runtime lease fields without leaving undefined values behind", async () => {
    const session: SessionRecord = {
      id: "session-1",
      wallet: "public-livestream",
      contractAddress: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      deviceId: "public-autoblow",
      deviceType: "autoblow",
      mode: "live",
      status: "active",
      createdAt: "2026-03-23T19:00:00.000Z",
      updatedAt: "2026-03-23T19:00:00.000Z",
      runtimeOwnerId: "runtime-1",
      runtimeLeaseExpiresAt: "2026-03-23T19:00:30.000Z",
    };

    await upsertSession(session);
    await markSessionStopped(session.id);

    const saved = await getSession(session.id);
    expect(saved?.status).toBe("stopped");
    expect(saved).not.toHaveProperty("runtimeOwnerId");
    expect(saved).not.toHaveProperty("runtimeLeaseExpiresAt");
  });
});
