"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";

type ResolvedMedia =
  | {
      kind: "video";
      src: string;
      streamType: "file" | "hls";
      provider: string;
      method: "direct" | "extracted" | "yt-dlp";
    }
  | {
      kind: "iframe";
      src: string;
      provider: string;
      method: "embed" | "extracted";
    };

type MediaHistory = Record<string, string[]>;

function normalizeProviderKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getMethodLabel(method: ResolvedMedia["method"]) {
  switch (method) {
    case "direct":
      return "Direct video";
    case "yt-dlp":
      return "Optimized playback";
    case "embed":
      return "Embedded player";
    case "extracted":
      return "Playable source";
  }
}

function getFormatLabel(resolved: ResolvedMedia) {
  if (resolved.kind === "iframe") {
    return "Web player";
  }

  return resolved.streamType === "hls" ? "Live stream" : "Video file";
}

export function MediaEmbedPanel({
  title,
  eyebrow = "Media",
  description,
  defaultUrl = "",
  storageKey,
  readOnly = false,
  onActiveUrlChange,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  defaultUrl?: string;
  storageKey: string;
  readOnly?: boolean;
  onActiveUrlChange?: (url: string) => void;
}) {
  const [draftUrl, setDraftUrl] = useState(defaultUrl);
  const [activeUrl, setActiveUrl] = useState(defaultUrl);
  const [parentHost, setParentHost] = useState("localhost");
  const [resolved, setResolved] = useState<ResolvedMedia | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [providerHistoryCount, setProviderHistoryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const historyStorageKey = `${storageKey}:history`;

  const readHistory = useCallback((): MediaHistory => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(historyStorageKey);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as MediaHistory;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [historyStorageKey]);

  const writeHistory = useCallback(
    (nextHistory: MediaHistory) => {
      if (typeof window === "undefined" || readOnly) {
        return;
      }

      window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
    },
    [historyStorageKey, readOnly],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    setParentHost(window.location.hostname || "localhost");

    if (readOnly) {
      setDraftUrl(defaultUrl);
      setActiveUrl(defaultUrl);
      return;
    }

    const stored = window.localStorage.getItem(storageKey);
    const next = stored || defaultUrl;
    setDraftUrl(next);
    setActiveUrl(next);
  }, [defaultUrl, readOnly, storageKey]);

  useEffect(() => {
    let cancelled = false;
    const trimmedUrl = activeUrl.trim();

    if (!trimmedUrl) {
      setResolved(null);
      setResolveError(null);
      setResolving(false);
      return;
    }

    async function resolve() {
      setResolving(true);
      setResolveError(null);

      try {
        const response = await fetch(
          `/api/media/resolve?url=${encodeURIComponent(trimmedUrl)}&parentHost=${encodeURIComponent(parentHost)}`,
        );
        const payload = (await response.json()) as
          | ResolvedMedia
          | {
              error?: string;
            };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error || "Failed to resolve media" : "Failed to resolve media",
          );
        }

        if (!cancelled && "kind" in payload) {
          setResolved(payload as ResolvedMedia);
        }
      } catch (error) {
        if (!cancelled) {
          setResolved(null);
          setResolveError(
            error instanceof Error ? error.message : "Failed to resolve media",
          );
        }
      } finally {
        if (!cancelled) {
          setResolving(false);
        }
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [activeUrl, parentHost]);

  useEffect(() => {
    if (typeof window === "undefined" || readOnly || !resolved || !activeUrl.trim()) {
      setProviderHistoryCount(0);
      return;
    }

    const providerKey = normalizeProviderKey(resolved.provider);
    const history = readHistory();
    const providerHistory = history[providerKey] ?? [];
    const nextProviderHistory = [
      activeUrl.trim(),
      ...providerHistory.filter((item) => item !== activeUrl.trim()),
    ].slice(0, 24);

    writeHistory({
      ...history,
      [providerKey]: nextProviderHistory,
    });
    setProviderHistoryCount(nextProviderHistory.length);
  }, [activeUrl, readHistory, readOnly, resolved, writeHistory]);

  useEffect(() => {
    onActiveUrlChange?.(activeUrl.trim());
  }, [activeUrl, onActiveUrlChange]);

  useEffect(() => {
    if (!resolved || resolved.kind !== "video" || resolved.streamType !== "hls") {
      return;
    }

    if (!videoRef.current) {
      return;
    }
    const currentVideo = videoRef.current;
    const embedSrc = resolved.src;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function attachHls() {
      if (currentVideo.canPlayType("application/vnd.apple.mpegurl")) {
        currentVideo.src = embedSrc;
        return;
      }

      const hlsModule = await import("hls.js");
      if (disposed || !videoRef.current) {
        return;
      }

      const Hls = hlsModule.default;
      if (!Hls.isSupported()) {
        currentVideo.src = embedSrc;
        return;
      }

      const hls = new Hls({
        enableWorker: true,
      });
      hls.loadSource(embedSrc);
      hls.attachMedia(currentVideo);
      cleanup = () => hls.destroy();
    }

    void attachHls();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [resolved]);

  const statusBadges = useMemo(() => {
    if (resolving) {
      return [
        <StatusBadge key="status" tone="accent">
          Resolving source
        </StatusBadge>,
      ];
    }

    if (!resolved) {
      return [];
    }

    return [
      <StatusBadge key="provider" tone="accent">
        {resolved.provider}
      </StatusBadge>,
      <StatusBadge key="method" tone="neutral">
        {getMethodLabel(resolved.method)}
      </StatusBadge>,
      <StatusBadge key="format" tone="success">
        {getFormatLabel(resolved)}
      </StatusBadge>,
    ];
  }, [resolved, resolving]);

  function applyUrl() {
    const nextUrl = draftUrl.trim();
    setResolveError(null);
    setActiveUrl(nextUrl);
    if (typeof window !== "undefined" && !readOnly) {
      window.localStorage.setItem(storageKey, nextUrl);
    }
  }

  function clearUrl() {
    setDraftUrl("");
    setActiveUrl("");
    setResolved(null);
    setResolveError(null);
    setProviderHistoryCount(0);
    if (typeof window !== "undefined" && !readOnly) {
      window.localStorage.removeItem(storageKey);
    }
  }

  function playRandomFromProvider() {
    if (!resolved) {
      return;
    }

    const providerKey = normalizeProviderKey(resolved.provider);
    const history = readHistory();
    const choices = (history[providerKey] ?? []).filter(
      (item) => item !== activeUrl.trim(),
    );

    if (!choices.length) {
      setResolveError(
        `Add more ${resolved.provider} links first, then randomize within that platform.`,
      );
      return;
    }

    const nextUrl = choices[Math.floor(Math.random() * choices.length)];
    setResolveError(null);
    setDraftUrl(nextUrl);
    setActiveUrl(nextUrl);
    if (typeof window !== "undefined" && !readOnly) {
      window.localStorage.setItem(storageKey, nextUrl);
    }
  }

  return (
    <section className="panel media-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          {resolving
            ? "Resolving"
            : resolved?.provider || (activeUrl.trim() ? "Queued" : "No source")}
        </div>
      </div>

      {description ? <p className="hero-summary compact">{description}</p> : null}

      {!readOnly ? (
        <div className="media-toolbar">
          <label className="field">
            <span>Video or stream link</span>
            <input
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyUrl();
                }
              }}
              placeholder="Paste a YouTube, Twitch, Vimeo, or direct video link"
            />
          </label>
          <p className="inline-note">
            Paste a link and we&apos;ll try to load the cleanest playable version
            available. Random playback cycles through links you&apos;ve already
            opened from the same provider.
          </p>
          <div className="button-row">
            <button className="button button-primary small" onClick={applyUrl} type="button">
              Load video
            </button>
            <button
              className="button button-secondary small"
              disabled={!resolved || providerHistoryCount < 2}
              onClick={playRandomFromProvider}
              type="button"
            >
              {resolved ? `Play random ${resolved.provider}` : "Play random media"}
            </button>
            <button className="button button-ghost small" onClick={clearUrl} type="button">
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {statusBadges.length ? <div className="route-badges">{statusBadges}</div> : null}
      {resolveError ? <p className="error-banner">{resolveError}</p> : null}

      {resolved ? (
        resolved.kind === "video" ? (
          <div className="embed-shell">
            <video
              key={resolved.src}
              className="media-video"
              controls
              playsInline
              ref={videoRef}
              src={resolved.streamType === "file" ? resolved.src : undefined}
            />
          </div>
        ) : (
          <div className="embed-shell">
            <iframe
              key={resolved.src}
              src={resolved.src}
              className="embed-frame"
              title={`${resolved.provider} embed`}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )
      ) : resolving ? (
        <div className="embed-placeholder">
          <strong>Finding the best way to play this link.</strong>
          <p>We&apos;re checking for the cleanest playable source.</p>
        </div>
      ) : (
        <div className="embed-placeholder">
          <strong>Ready for a stream when you are.</strong>
          <p>
            Paste a video or stream link and this panel will switch into playback mode.
          </p>
        </div>
      )}
    </section>
  );
}
