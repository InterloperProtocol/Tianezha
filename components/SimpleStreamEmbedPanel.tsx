"use client";

import { useMemo } from "react";

function extractYoutubeId(url: URL) {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }

  if (url.hostname.includes("youtube.com")) {
    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/").filter(Boolean)[1] || "";
    }

    return url.searchParams.get("v") || "";
  }

  return "";
}

function extractKickChannel(url: URL) {
  if (url.hostname.includes("player.kick.com")) {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }

  if (url.hostname.includes("kick.com")) {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }

  return "";
}

function resolveSimpleStream(urlValue: string) {
  const trimmed = urlValue.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const lowerPath = url.pathname.toLowerCase();

    if (url.hostname.includes("kick.com")) {
      const channel = extractKickChannel(url);
      return {
        kind: "iframe" as const,
        provider: "Kick",
        src: channel ? `https://player.kick.com/${channel}` : trimmed,
      };
    }

    if (url.hostname.includes("youtube.com") || url.hostname === "youtu.be") {
      const videoId = extractYoutubeId(url);
      return {
        kind: "iframe" as const,
        provider: "YouTube",
        src: videoId ? `https://www.youtube.com/embed/${videoId}` : trimmed,
      };
    }

    if (
      lowerPath.endsWith(".mp4") ||
      lowerPath.endsWith(".webm") ||
      lowerPath.endsWith(".ogg")
    ) {
      return {
        kind: "video" as const,
        provider: "Direct video",
        src: trimmed,
      };
    }

    return {
      kind: "iframe" as const,
      provider: "Stream",
      src: trimmed,
    };
  } catch {
    return null;
  }
}

export function SimpleStreamEmbedPanel({
  title,
  eyebrow = "Stream",
  description,
  url,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  url: string;
}) {
  const resolved = useMemo(() => resolveSimpleStream(url), [url]);

  return (
    <section className="panel media-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {resolved?.provider || "No stream"}
        </div>
      </div>

      {description ? <p className="hero-summary compact">{description}</p> : null}

      {resolved ? (
        resolved.kind === "video" ? (
          <div className="embed-shell">
            <video className="media-video" controls playsInline src={resolved.src} />
          </div>
        ) : (
          <div className="embed-shell">
            <iframe
              key={resolved.src}
              src={resolved.src}
              className="embed-frame"
              title={`${resolved.provider} stream`}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )
      ) : (
        <div className="embed-placeholder">
          <strong>No stream loaded.</strong>
          <p>This page only shows a simple player.</p>
        </div>
      )}
    </section>
  );
}
