import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const internalAdminModule = vi.hoisted(() => ({
  hidePublicStreamProfile: vi.fn(),
  requireInternalAdminSession: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  assertSameOriginMutation: vi.fn(),
}));

vi.mock("@/lib/server/internal-admin", () => internalAdminModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/internal-admin/goonconnect/profiles/[guestId]/hide/route";

describe("/api/internal-admin/goonconnect/profiles/[guestId]/hide", () => {
  beforeEach(() => {
    internalAdminModule.hidePublicStreamProfile.mockReset();
    internalAdminModule.requireInternalAdminSession.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
  });

  it("returns 401 when the owner is not authenticated", async () => {
    internalAdminModule.requireInternalAdminSession.mockRejectedValue(
      new Error("Admin authentication required"),
    );

    const request = new NextRequest("https://example.com/api/internal-admin/goonconnect/profiles/test/hide", {
      method: "POST",
      body: JSON.stringify({ reason: "hide" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ guestId: "test" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Admin authentication required");
  });

  it("hides the profile for an authenticated owner", async () => {
    internalAdminModule.requireInternalAdminSession.mockResolvedValue({
      username: "owner",
    });
    internalAdminModule.hidePublicStreamProfile.mockResolvedValue({
      guestId: "test",
      isHidden: true,
    });

    const request = new NextRequest("https://example.com/api/internal-admin/goonconnect/profiles/test/hide", {
      method: "POST",
      body: JSON.stringify({ reason: "hide" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ guestId: "test" }),
    });
    const payload = (await response.json()) as {
      item: { guestId: string; isHidden: boolean };
    };

    expect(response.status).toBe(200);
    expect(internalAdminModule.hidePublicStreamProfile).toHaveBeenCalledWith({
      guestId: "test",
      adminUsername: "owner",
      reason: "hide",
    });
    expect(payload.item).toMatchObject({
      guestId: "test",
      isHidden: true,
    });
  });
});
