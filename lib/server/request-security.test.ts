import { afterEach, describe, expect, it, vi } from "vitest";

import { resetServerEnvForTests } from "@/lib/env";
import { resetPolicyRuntimeStoreForTests } from "@/lib/server/policy-runtime-store";
import {
  assertSafeExternalHttpUrl,
  assertSameOriginMutation,
  enforceRequestRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/server/request-security";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvForTests();
  resetPolicyRuntimeStoreForTests();
});

describe("assertSameOriginMutation", () => {
  it("allows same-origin mutations against the direct request origin", () => {
    const request = new Request("https://tianshi.example/api/internal-admin/auth/login", {
      headers: {
        origin: "https://tianshi.example",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).not.toThrow();
  });

  it("allows explicitly configured public origins behind a hosting proxy", () => {
    vi.stubEnv(
      "TIANEZHA_ALLOWED_MUTATION_ORIGINS",
      "https://tianshi--tianezha-app.us-east4.hosted.app",
    );
    resetServerEnvForTests();

    const request = new Request("https://internal.service/api/internal-admin/auth/login", {
      headers: {
        origin: "https://tianshi--tianezha-app.us-east4.hosted.app",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).not.toThrow();
  });

  it("rejects real cross-origin mutations", () => {
    const request = new Request("https://tianshi.example/api/internal-admin/auth/login", {
      headers: {
        origin: "https://evil.example",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).toThrow(
      "Cross-origin state changes are not allowed",
    );
  });

  it("rejects forged forwarded origins without an explicit allowlist match", () => {
    const request = new Request("https://internal.service/api/internal-admin/auth/login", {
      headers: {
        origin: "https://evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).toThrow(
      "Cross-origin state changes are not allowed",
    );
  });
});

describe("enforceRequestRateLimit", () => {
  it("tracks request windows through the persistent rate-limit boundary", async () => {
    const request = new Request("https://tianshi.example/api/auth/nonce", {
      headers: {
        "user-agent": "vitest",
        "x-real-ip": "203.0.113.10",
      },
      method: "POST",
    });

    await expect(
      enforceRequestRateLimit({
        request,
        scope: "unit-test",
        max: 1,
        windowMs: 60_000,
      }),
    ).resolves.toBeUndefined();

    let thrown: unknown = null;
    try {
      await enforceRequestRateLimit({
        request,
        scope: "unit-test",
        max: 1,
        windowMs: 60_000,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("Too many requests.");
    expect(getRateLimitRetryAfterSeconds(thrown)).toBeGreaterThanOrEqual(1);
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
