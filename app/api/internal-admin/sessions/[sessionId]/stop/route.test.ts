import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const internalAdminModule = vi.hoisted(() => ({
  requireInternalAdminSession: vi.fn(),
  stopSessionFromAdmin: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  assertSameOriginMutation: vi.fn(),
}));

vi.mock("@/lib/server/internal-admin", () => internalAdminModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/internal-admin/sessions/[sessionId]/stop/route";

describe("/api/internal-admin/sessions/[sessionId]/stop", () => {
  beforeEach(() => {
    internalAdminModule.requireInternalAdminSession.mockReset();
    internalAdminModule.stopSessionFromAdmin.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
  });

  it("returns 401 when the owner is not authenticated", async () => {
    internalAdminModule.requireInternalAdminSession.mockRejectedValue(
      new Error("Admin authentication required"),
    );

    const request = new NextRequest("https://example.com/api/internal-admin/sessions/session-1/stop", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Admin authentication required");
  });

  it("stops the stream for an authenticated owner", async () => {
    internalAdminModule.requireInternalAdminSession.mockResolvedValue({
      username: "owner",
    });
    internalAdminModule.stopSessionFromAdmin.mockResolvedValue({
      ok: true,
    });

    const request = new NextRequest("https://example.com/api/internal-admin/sessions/session-1/stop", {
      method: "POST",
    });
    const response = await POST(request, {
      params: Promise.resolve({ sessionId: "session-1" }),
    });
    const payload = (await response.json()) as { item: { ok: boolean } };

    expect(response.status).toBe(200);
    expect(internalAdminModule.stopSessionFromAdmin).toHaveBeenCalledWith("session-1");
    expect(payload.item.ok).toBe(true);
  });
});
