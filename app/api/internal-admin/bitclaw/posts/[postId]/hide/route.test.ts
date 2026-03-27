import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bitClawModule = vi.hoisted(() => ({
  hideBitClawPost: vi.fn(),
}));

const internalAdminModule = vi.hoisted(() => ({
  requireInternalAdminSession: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  assertSameOriginMutation: vi.fn(),
}));

vi.mock("@/lib/server/bitclaw", () => bitClawModule);
vi.mock("@/lib/server/internal-admin", () => internalAdminModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { POST } from "@/app/api/internal-admin/bitclaw/posts/[postId]/hide/route";

describe("/api/internal-admin/bitclaw/posts/[postId]/hide", () => {
  beforeEach(() => {
    bitClawModule.hideBitClawPost.mockReset();
    internalAdminModule.requireInternalAdminSession.mockReset();
    requestSecurityModule.assertSameOriginMutation.mockReset();
  });

  it("returns 401 when the owner is not authenticated", async () => {
    internalAdminModule.requireInternalAdminSession.mockRejectedValue(
      new Error("Admin authentication required"),
    );

    const request = new NextRequest("https://example.com/api/internal-admin/bitclaw/posts/post-1/hide", {
      method: "POST",
      body: JSON.stringify({ reason: "hide" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ postId: "post-1" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Admin authentication required");
  });

  it("hides the post for an authenticated owner", async () => {
    internalAdminModule.requireInternalAdminSession.mockResolvedValue({
      username: "owner",
    });
    bitClawModule.hideBitClawPost.mockResolvedValue({
      id: "post-1",
      isHidden: true,
    });

    const request = new NextRequest("https://example.com/api/internal-admin/bitclaw/posts/post-1/hide", {
      method: "POST",
      body: JSON.stringify({ reason: "hide" }),
    });
    const response = await POST(request, {
      params: Promise.resolve({ postId: "post-1" }),
    });
    const payload = (await response.json()) as {
      item: { id: string; isHidden: boolean };
    };

    expect(response.status).toBe(200);
    expect(bitClawModule.hideBitClawPost).toHaveBeenCalledWith({
      adminUsername: "owner",
      postId: "post-1",
      reason: "hide",
    });
    expect(payload.item).toMatchObject({
      id: "post-1",
      isHidden: true,
    });
  });
});
