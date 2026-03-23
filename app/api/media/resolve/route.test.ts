import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mediaModule = vi.hoisted(() => ({
  resolveMediaSource: vi.fn(),
}));

const requestSecurityModule = vi.hoisted(() => ({
  assertSafeExternalHttpUrl: vi.fn(),
}));

vi.mock("@/lib/server/media", () => mediaModule);
vi.mock("@/lib/server/request-security", () => requestSecurityModule);

import { GET } from "@/app/api/media/resolve/route";

describe("/api/media/resolve", () => {
  beforeEach(() => {
    mediaModule.resolveMediaSource.mockReset();
    requestSecurityModule.assertSafeExternalHttpUrl.mockReset();
    requestSecurityModule.assertSafeExternalHttpUrl.mockImplementation(
      async (value: string) => value,
    );
  });

  it("returns 400 when url is missing", async () => {
    const request = new NextRequest("https://example.com/api/media/resolve");
    const response = await GET(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Missing media URL");
  });

  it("returns resolved media JSON on success", async () => {
    mediaModule.resolveMediaSource.mockResolvedValue({
      kind: "video",
      src: "https://cdn.example.com/video.mp4",
      streamType: "file",
      provider: "Pornhub",
      method: "yt-dlp",
    });

    const request = new NextRequest(
      "https://example.com/api/media/resolve?url=https%3A%2F%2Fexample.com%2Fclip&parentHost=example.com",
    );
    const response = await GET(request);
    const payload = (await response.json()) as {
      kind: string;
      method: string;
      provider: string;
    };

    expect(response.status).toBe(200);
    expect(requestSecurityModule.assertSafeExternalHttpUrl).toHaveBeenCalledWith(
      "https://example.com/clip",
      { label: "Media URL" },
    );
    expect(mediaModule.resolveMediaSource).toHaveBeenCalledWith(
      "https://example.com/clip",
      "example.com",
    );
    expect(payload).toMatchObject({
      kind: "video",
      method: "yt-dlp",
      provider: "Pornhub",
    });
  });

  it("falls back to the forwarded host when parentHost is invalid", async () => {
    mediaModule.resolveMediaSource.mockResolvedValue({
      kind: "iframe",
      src: "https://player.example.com/embed/123",
      provider: "Twitch",
      method: "embed",
    });

    const request = new NextRequest(
      "https://internal.example/api/media/resolve?url=https%3A%2F%2Fexample.com%2Fclip&parentHost=https%3A%2F%2Fevil.example%2Fbad",
      {
        headers: {
          "x-forwarded-host": "preview.example.com",
        },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mediaModule.resolveMediaSource).toHaveBeenCalledWith(
      "https://example.com/clip",
      "preview.example.com",
    );
  });

  it("returns 404 when no playable source is found", async () => {
    mediaModule.resolveMediaSource.mockResolvedValue(null);

    const request = new NextRequest(
      "https://example.com/api/media/resolve?url=https%3A%2F%2Fexample.com%2Funknown",
    );
    const response = await GET(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(payload.error).toBe(
      "Could not resolve a playable or embeddable media source",
    );
  });

  it("returns 400 when the resolver throws", async () => {
    mediaModule.resolveMediaSource.mockRejectedValue(
      new Error("yt-dlp timed out while resolving the media URL."),
    );

    const request = new NextRequest(
      "https://example.com/api/media/resolve?url=https%3A%2F%2Fexample.com%2Fslow",
    );
    const response = await GET(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("yt-dlp timed out while resolving the media URL.");
  });

  it("rejects unsafe target URLs before resolving media", async () => {
    requestSecurityModule.assertSafeExternalHttpUrl.mockRejectedValue(
      new Error("Media URL must not target private or metadata addresses"),
    );

    const request = new NextRequest(
      "https://example.com/api/media/resolve?url=http%3A%2F%2F127.0.0.1%3A8080%2Fprivate",
    );
    const response = await GET(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe(
      "Media URL must not target private or metadata addresses",
    );
    expect(mediaModule.resolveMediaSource).not.toHaveBeenCalled();
  });
});
