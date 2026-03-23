import { describe, expect, it } from "vitest";

import {
  assertSafeExternalHttpUrl,
  assertSameOriginMutation,
} from "@/lib/server/request-security";

describe("assertSameOriginMutation", () => {
  it("allows same-origin mutations against the direct request origin", () => {
    const request = new Request("https://goonclaw.example/api/internal-admin/auth/login", {
      headers: {
        origin: "https://goonclaw.example",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).not.toThrow();
  });

  it("allows forwarded public origins behind a hosting proxy", () => {
    const request = new Request("https://internal.service/api/internal-admin/auth/login", {
      headers: {
        origin: "https://goonclaw--goonclaw-app.us-east4.hosted.app",
        "x-forwarded-host": "goonclaw--goonclaw-app.us-east4.hosted.app",
        "x-forwarded-proto": "https",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).not.toThrow();
  });

  it("rejects real cross-origin mutations", () => {
    const request = new Request("https://goonclaw.example/api/internal-admin/auth/login", {
      headers: {
        origin: "https://evil.example",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).toThrow(
      "Cross-origin state changes are not allowed",
    );
  });
});

describe("assertSafeExternalHttpUrl", () => {
  it("rejects localhost-style media targets by default", async () => {
    await expect(
      assertSafeExternalHttpUrl("http://127.0.0.1:8080/private-feed.m3u8", {
        label: "Media URL",
      }),
    ).rejects.toThrow("Media URL must not target private or metadata addresses");
  });

  it("allows public IP targets", async () => {
    await expect(
      assertSafeExternalHttpUrl("https://8.8.8.8/stream.mp4", {
        label: "Media URL",
      }),
    ).resolves.toBe("https://8.8.8.8/stream.mp4");
  });
});
