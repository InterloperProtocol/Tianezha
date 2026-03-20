import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildYtDlpCookieArgs,
  buildKnownMediaConfig,
  mapYtDlpFailureMessage,
  normalizeYtDlpMedia,
  resolveMediaSource,
} from "@/lib/server/media";

describe("media source resolver", () => {
  it("builds a YouTube embed from a watch URL", () => {
    expect(
      buildKnownMediaConfig(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "localhost",
      ),
    ).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      provider: "YouTube",
      method: "embed",
    });
  });

  it("builds a Pornhub embed from a viewkey URL", () => {
    expect(
      buildKnownMediaConfig(
        "https://www.pornhub.com/view_video.php?viewkey=ph123456789",
        "localhost",
      ),
    ).toEqual({
      kind: "iframe",
      src: "https://www.pornhub.com/embed/ph123456789",
      provider: "Pornhub",
      method: "embed",
    });
  });

  it("builds an XVideos embed from a canonical video URL", () => {
    expect(
      buildKnownMediaConfig(
        "https://www.xvideos.com/video123456/example-scene",
        "localhost",
      ),
    ).toEqual({
      kind: "iframe",
      src: "https://www.xvideos.com/embedframe/123456",
      provider: "XVideos",
      method: "embed",
    });
  });

  it("builds a Chaturbate room embed from a room URL", () => {
    expect(
      buildKnownMediaConfig(
        "https://chaturbate.com/example_room/",
        "localhost",
      ),
    ).toEqual({
      kind: "iframe",
      src: "https://chaturbate.com/embed/example_room/",
      provider: "Chaturbate",
      method: "embed",
    });
  });

  it("builds a Kick channel embed from a channel URL", () => {
    expect(
      buildKnownMediaConfig(
        "https://kick.com/goonclaw",
        "localhost",
      ),
    ).toEqual({
      kind: "iframe",
      src: "https://player.kick.com/goonclaw",
      provider: "Kick",
      method: "embed",
    });
  });

  it("preserves direct HLS media sources", () => {
    expect(
      buildKnownMediaConfig(
        "https://cdn.example.com/playlist.m3u8",
        "localhost",
      ),
    ).toEqual({
      kind: "video",
      src: "https://cdn.example.com/playlist.m3u8",
      streamType: "hls",
      provider: "Direct media",
      method: "direct",
    });
  });

  it("bypasses yt-dlp for direct media URLs", async () => {
    await expect(
      resolveMediaSource("https://cdn.example.com/video.mp4", "localhost", {
        resolveWithYtDlp: async () => {
          throw new Error("yt-dlp should not run for direct files");
        },
      }),
    ).resolves.toEqual({
      kind: "video",
      src: "https://cdn.example.com/video.mp4",
      streamType: "file",
      provider: "Direct media",
      method: "direct",
    });
  });

  it("normalizes yt-dlp MP4 payloads into direct playback", () => {
    expect(
      normalizeYtDlpMedia({
        extractor_key: "PornHub",
        webpage_url: "https://www.pornhub.com/view_video.php?viewkey=ph123",
        formats: [
          {
            url: "https://cdn.example.com/video-720.mp4",
            ext: "mp4",
            protocol: "https",
            acodec: "aac",
            vcodec: "avc1",
            height: 720,
          },
        ],
      }),
    ).toEqual({
      kind: "video",
      src: "https://cdn.example.com/video-720.mp4",
      streamType: "file",
      provider: "Pornhub",
      method: "yt-dlp",
    });
  });

  it("normalizes yt-dlp HLS payloads into live playback", () => {
    expect(
      normalizeYtDlpMedia({
        extractor_key: "Youtube",
        webpage_url: "https://www.youtube.com/watch?v=test",
        is_live: true,
        formats: [
          {
            url: "https://manifest.example.com/live/master.m3u8",
            ext: "mp4",
            protocol: "m3u8_native",
            acodec: "none",
            vcodec: "avc1",
            height: 1080,
          },
        ],
      }),
    ).toEqual({
      kind: "video",
      src: "https://manifest.example.com/live/master.m3u8",
      streamType: "hls",
      provider: "YouTube",
      method: "yt-dlp",
    });
  });

  it("falls back to provider embeds when yt-dlp has no playable result", async () => {
    await expect(
      resolveMediaSource(
        "https://www.pornhub.com/view_video.php?viewkey=ph123456789",
        "localhost",
        {
          resolveWithYtDlp: async () => null,
          extractMediaFromPage: async () => null,
        },
      ),
    ).resolves.toEqual({
      kind: "iframe",
      src: "https://www.pornhub.com/embed/ph123456789",
      provider: "Pornhub",
      method: "embed",
    });
  });

  it("falls back to the YouTube embed when yt-dlp hits the bot check", async () => {
    await expect(
      resolveMediaSource(
        "https://www.youtube.com/watch?v=FKXWo-PNmCc",
        "localhost",
        {
          resolveWithYtDlp: async () => {
            throw new Error(
              "YouTube asked for bot verification. Configure YT_DLP_COOKIES_PATH or YT_DLP_COOKIES_FROM_BROWSER on the server for authenticated yt-dlp playback.",
            );
          },
          extractMediaFromPage: async () => null,
        },
      ),
    ).resolves.toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/FKXWo-PNmCc",
      provider: "YouTube",
      method: "embed",
    });
  });

  it("returns null for unsupported URLs when yt-dlp and fallback extraction both fail", async () => {
    await expect(
      resolveMediaSource("https://example.com/no-player-here", "localhost", {
        resolveWithYtDlp: async () => null,
        extractMediaFromPage: async () => null,
      }),
    ).resolves.toBeNull();
  });

  it("builds yt-dlp cookie args from a cookie file path", () => {
    expect(
      buildYtDlpCookieArgs({
        YT_DLP_COOKIES_PATH: ".secrets/youtube.cookies.txt",
        YT_DLP_COOKIES_FROM_BROWSER: "",
      }),
    ).toEqual([
      "--cookies",
      path.resolve(".secrets/youtube.cookies.txt"),
    ]);
  });

  it("builds yt-dlp cookie args from a browser source when no cookie file is set", () => {
    expect(
      buildYtDlpCookieArgs({
        YT_DLP_COOKIES_PATH: "",
        YT_DLP_COOKIES_FROM_BROWSER: "chrome:Default",
      }),
    ).toEqual(["--cookies-from-browser", "chrome:Default"]);
  });

  it("maps YouTube bot checks to a cleaner cookie guidance message", () => {
    expect(
      mapYtDlpFailureMessage(
        "ERROR",
        "[youtube] FKXWo-PNmCc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.",
        false,
      ),
    ).toBe(
      "YouTube asked for bot verification. Configure YT_DLP_COOKIES_PATH or YT_DLP_COOKIES_FROM_BROWSER on the server for authenticated yt-dlp playback.",
    );
  });
});
