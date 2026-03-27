import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import AdmZip from "adm-zip";

import { getServerEnv, type ServerEnv } from "@/lib/env";

type MediaStreamType = "file" | "hls";
type VideoMethod = "direct" | "extracted" | "yt-dlp";
type IframeMethod = "embed" | "extracted";

type YtDlpFormat = {
  url?: string;
  ext?: string;
  protocol?: string;
  acodec?: string;
  vcodec?: string;
  height?: number;
  width?: number;
  tbr?: number;
  preference?: number;
  source_preference?: number;
  quality?: number;
  manifest_url?: string;
};

type YtDlpPayload = {
  extractor?: string;
  extractor_key?: string;
  webpage_url?: string;
  original_url?: string;
  url?: string;
  ext?: string;
  protocol?: string;
  acodec?: string;
  vcodec?: string;
  is_live?: boolean;
  live_status?: string;
  formats?: YtDlpFormat[];
};

type CacheEntry = {
  expiresAt: number;
  value: ResolvedMedia | null;
};

type MediaResolverDeps = {
  resolveWithYtDlp?: (value: string) => Promise<ResolvedMedia | null>;
  extractMediaFromPage?: (
    value: string,
    providerLabel?: string,
  ) => Promise<ResolvedMedia | null>;
  knownConfigBuilder?: (value: string, parentHost: string) => ResolvedMedia | null;
};

const execFileAsync = promisify(execFile);
const DEFAULT_CHATURBATE_EMBED_URL =
  "https://chaturbate.com/in/?track=test1&tour=dTm0&campaign=rnWfN&disable_sound=1&embed_video_only=1";
const YT_DLP_VERSION = "2025.12.08";
const DENO_VERSION = "v2.6.4";
const YT_DLP_TIMEOUT_MS = 25_000;
const DEFAULT_CACHE_TTL_MS = 3 * 60 * 1_000;
const LIVE_CACHE_TTL_MS = 45 * 1_000;
const SIGNED_URL_CACHE_TTL_MS = 30 * 1_000;
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};
const YT_DLP_CACHE = new Map<string, CacheEntry>();
const RUNTIME_TOOLS_CANDIDATES = [
  path.join(process.cwd(), "runtime-tools", "linux-x64"),
  path.join(process.cwd(), ".next", "standalone", "runtime-tools", "linux-x64"),
  path.join(__dirname, "..", "..", "runtime-tools", "linux-x64"),
];
const RUNTIME_TOOLS_ROOT =
  RUNTIME_TOOLS_CANDIDATES.find((candidate) => existsSync(candidate)) ??
  RUNTIME_TOOLS_CANDIDATES[0];
const BUNDLED_YT_DLP_PATH = path.join(RUNTIME_TOOLS_ROOT, `yt-dlp-${YT_DLP_VERSION}`);
const BUNDLED_DENO_ARCHIVE_PATH = path.join(
  RUNTIME_TOOLS_ROOT,
  `deno-${DENO_VERSION}-x86_64-unknown-linux-gnu.zip`,
);
const EXTRACTED_DENO_ROOT = path.join(
  os.tmpdir(),
  "tianshi-media-runtime",
  `deno-${DENO_VERSION}`,
);
const EXTRACTED_DENO_PATH = path.join(EXTRACTED_DENO_ROOT, "deno");

export type ResolvedMedia =
  | {
      kind: "video";
      src: string;
      streamType: MediaStreamType;
      provider: string;
      method: VideoMethod;
    }
  | {
      kind: "iframe";
      src: string;
      provider: string;
      method: IframeMethod;
    };

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function decodeEscapedUrl(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\\u002F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");
}

function normalizeUrl(value: string, baseUrl?: string) {
  const decoded = decodeEscapedUrl(value.trim());

  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return "";
  }
}

function detectStreamType(url: string): MediaStreamType {
  return /\.m3u8(\?|$)/i.test(url) ? "hls" : "file";
}

function asPlayableVideoUrl(url: string, provider: string, method: VideoMethod) {
  return {
    kind: "video" as const,
    src: url,
    streamType: detectStreamType(url),
    provider,
    method,
  };
}

function asIframeUrl(url: string, provider: string, method: IframeMethod) {
  return {
    kind: "iframe" as const,
    src: url,
    provider,
    method,
  };
}

function ensureExecutable(filePath: string, label: string) {
  if (!existsSync(filePath)) {
    throw new Error(
      `${label} runtime is missing at ${filePath}. Bundle the pinned Linux asset or set the matching env override.`,
    );
  }

  try {
    chmodSync(filePath, 0o755);
  } catch {
    throw new Error(`${label} runtime exists but is not executable at ${filePath}.`);
  }

  return filePath;
}

function resolveYtDlpPath() {
  if (process.env.YT_DLP_PATH?.trim()) {
    return ensureExecutable(process.env.YT_DLP_PATH.trim(), "yt-dlp");
  }

  if (process.platform !== "linux") {
    throw new Error(
      "yt-dlp requires YT_DLP_PATH outside Linux. Bundle the pinned Linux asset only in production or set a local override.",
    );
  }

  return ensureExecutable(BUNDLED_YT_DLP_PATH, "yt-dlp");
}

function resolveDenoPath() {
  if (process.env.DENO_PATH?.trim()) {
    return ensureExecutable(process.env.DENO_PATH.trim(), "Deno");
  }

  if (process.platform !== "linux") {
    throw new Error(
      "Deno requires DENO_PATH outside Linux. Set a local override for the official yt-dlp YouTube runtime.",
    );
  }

  if (existsSync(EXTRACTED_DENO_PATH)) {
    return ensureExecutable(EXTRACTED_DENO_PATH, "Deno");
  }

  if (!existsSync(BUNDLED_DENO_ARCHIVE_PATH)) {
    throw new Error(
      `Bundled Deno archive is missing at ${BUNDLED_DENO_ARCHIVE_PATH}.`,
    );
  }

  mkdirSync(EXTRACTED_DENO_ROOT, { recursive: true });

  try {
    const archive = new AdmZip(BUNDLED_DENO_ARCHIVE_PATH);
    archive.extractAllTo(EXTRACTED_DENO_ROOT, true);
  } catch {
    throw new Error("Bundled Deno archive could not be extracted.");
  }

  return ensureExecutable(EXTRACTED_DENO_PATH, "Deno");
}

function resolveConfiguredCookiesPath(value: string) {
  return path.resolve(value.trim());
}

type YtDlpCookieEnv = Pick<
  ServerEnv,
  "YT_DLP_COOKIES_PATH" | "YT_DLP_COOKIES_FROM_BROWSER"
>;

export function buildYtDlpCookieArgs(env: YtDlpCookieEnv) {
  const cookiesPath = env.YT_DLP_COOKIES_PATH.trim();
  if (cookiesPath) {
    return ["--cookies", resolveConfiguredCookiesPath(cookiesPath)];
  }

  const cookiesFromBrowser = env.YT_DLP_COOKIES_FROM_BROWSER.trim();
  if (cookiesFromBrowser) {
    return ["--cookies-from-browser", cookiesFromBrowser];
  }

  return [];
}

function hasYtDlpCookieConfig(env: YtDlpCookieEnv) {
  return Boolean(
    env.YT_DLP_COOKIES_PATH.trim() || env.YT_DLP_COOKIES_FROM_BROWSER.trim(),
  );
}

function normalizeYtDlpFailureText(value: string) {
  return value.replace(/[’`]/g, "'").toLowerCase();
}

export function mapYtDlpFailureMessage(
  message: string,
  stderr: string,
  hasCookieConfig: boolean,
) {
  const combinedMessage = normalizeYtDlpFailureText(`${message}\n${stderr}`);

  if (combinedMessage.includes("timed out")) {
    return "yt-dlp timed out while resolving the media URL.";
  }

  if (combinedMessage.includes("deno")) {
    return "Deno runtime is missing or incompatible for the official yt-dlp resolver.";
  }

  if (combinedMessage.includes("exec format error")) {
    return "yt-dlp or Deno binary is incompatible with this runtime.";
  }

  if (combinedMessage.includes("not found")) {
    return "yt-dlp runtime is missing or not executable.";
  }

  const hitBotChallenge =
    combinedMessage.includes("sign in to confirm you're not a bot") ||
    (combinedMessage.includes("--cookies-from-browser") &&
      combinedMessage.includes("--cookies")) ||
    combinedMessage.includes("cookies for the authentication");

  if (hitBotChallenge) {
    if (hasCookieConfig) {
      return "YouTube rejected the configured yt-dlp cookies. Refresh the cookie export and try again.";
    }

    return "YouTube asked for bot verification. Configure YT_DLP_COOKIES_PATH or YT_DLP_COOKIES_FROM_BROWSER on the server for authenticated yt-dlp playback.";
  }

  return stderr.trim()
    ? `yt-dlp failed to resolve this URL: ${stderr.trim()}`
    : "yt-dlp failed to resolve this URL.";
}

function cleanupExpiredCache() {
  const now = Date.now();

  for (const [key, entry] of YT_DLP_CACHE.entries()) {
    if (entry.expiresAt <= now) {
      YT_DLP_CACHE.delete(key);
    }
  }
}

function hasExpiringQuery(url: string) {
  try {
    const parsed = new URL(url);
    const signedKeys = [
      "exp",
      "expires",
      "signature",
      "sig",
      "token",
      "auth",
      "hdntl",
      "hdnea",
      "policy",
      "key",
      "jwt",
    ];

    return signedKeys.some((key) => parsed.searchParams.has(key));
  } catch {
    return false;
  }
}

function getCacheTtlMs(
  media: ResolvedMedia | null,
  payload: YtDlpPayload | null,
) {
  if (!media) {
    return SIGNED_URL_CACHE_TTL_MS;
  }

  if (payload?.is_live || payload?.live_status === "is_live") {
    return LIVE_CACHE_TTL_MS;
  }

  if (media.kind === "video" && hasExpiringQuery(media.src)) {
    return SIGNED_URL_CACHE_TTL_MS;
  }

  return DEFAULT_CACHE_TTL_MS;
}

function getCachedYtDlpMedia(value: string) {
  cleanupExpiredCache();
  const cached = YT_DLP_CACHE.get(value);

  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) {
      YT_DLP_CACHE.delete(value);
    }

    return undefined;
  }

  return cached.value;
}

function setCachedYtDlpMedia(
  value: string,
  media: ResolvedMedia | null,
  payload: YtDlpPayload | null,
) {
  YT_DLP_CACHE.set(value, {
    expiresAt: Date.now() + getCacheTtlMs(media, payload),
    value: media,
  });
}

function providerLabelForHost(hostname: string) {
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    return "YouTube";
  }

  if (hostname.includes("vimeo.com")) {
    return "Vimeo";
  }

  if (hostname.includes("twitch.tv")) {
    return "Twitch";
  }

  if (hostname.includes("kick.com")) {
    return "Kick";
  }

  if (hostname.includes("pornhub.com")) {
    return "Pornhub";
  }

  if (hostname.includes("xvideos.com")) {
    return "XVideos";
  }

  if (hostname.includes("eporner.com")) {
    return "Eporner";
  }

  if (hostname.includes("chaturbate.com")) {
    return "Chaturbate";
  }

  return "Extracted player";
}

function providerLabelFromYtDlp(payload: YtDlpPayload) {
  const source = `${payload.extractor_key || ""} ${payload.extractor || ""}`.toLowerCase();

  if (source.includes("youtube")) return "YouTube";
  if (source.includes("vimeo")) return "Vimeo";
  if (source.includes("twitch")) return "Twitch";
  if (source.includes("kick")) return "Kick";
  if (source.includes("pornhub")) return "Pornhub";
  if (source.includes("xvideos")) return "XVideos";
  if (source.includes("eporner")) return "Eporner";
  if (source.includes("chaturbate")) return "Chaturbate";

  const fallbackUrl =
    payload.webpage_url?.trim() || payload.original_url?.trim() || "";
  if (fallbackUrl) {
    try {
      return providerLabelForHost(new URL(fallbackUrl).hostname.toLowerCase());
    } catch {
      return "yt-dlp";
    }
  }

  return "yt-dlp";
}

function supportsPlayableContainer(format: YtDlpFormat) {
  const ext = (format.ext || "").toLowerCase();
  const protocol = (format.protocol || "").toLowerCase();
  const url = format.url || "";

  if (protocol.includes("m3u8") || /\.m3u8(\?|$)/i.test(url)) {
    return true;
  }

  return ["mp4", "webm", "ogg", "mov"].includes(ext);
}

function isHlsCandidate(format: YtDlpFormat) {
  const protocol = (format.protocol || "").toLowerCase();
  const url = format.url || "";
  const manifestUrl = format.manifest_url || "";

  return (
    protocol.includes("m3u8") ||
    /\.m3u8(\?|$)/i.test(url) ||
    /\.m3u8(\?|$)/i.test(manifestUrl)
  );
}

function hasAudioAndVideo(format: YtDlpFormat) {
  return format.vcodec !== "none" && format.acodec !== "none";
}

function isUnusableBrowserFormat(format: YtDlpFormat) {
  const protocol = (format.protocol || "").toLowerCase();
  const ext = (format.ext || "").toLowerCase();

  if (!format.url) {
    return true;
  }

  if (format.vcodec === "none") {
    return true;
  }

  if (["mhtml", "f4m", "ism"].includes(ext)) {
    return true;
  }

  return protocol.includes("dash") || protocol.includes("mhtml");
}

function scorePlayableFormat(format: YtDlpFormat) {
  let score = 0;

  if (isHlsCandidate(format)) {
    score += 1_200;
  }

  if (hasAudioAndVideo(format)) {
    score += 700;
  }

  switch ((format.ext || "").toLowerCase()) {
    case "mp4":
      score += 450;
      break;
    case "webm":
      score += 300;
      break;
    case "mov":
      score += 200;
      break;
    default:
      break;
  }

  if ((format.protocol || "").toLowerCase().startsWith("https")) {
    score += 50;
  }

  score += Math.min(format.height ?? 0, 2160);
  score += Math.round(Math.min(format.tbr ?? 0, 8_000) / 12);
  score += (format.preference ?? 0) * 5;
  score += (format.source_preference ?? 0) * 5;
  score += (format.quality ?? 0) * 2;

  return score;
}

function topLevelPayloadToFormat(payload: YtDlpPayload): YtDlpFormat | null {
  if (!payload.url) {
    return null;
  }

  return {
    url: payload.url,
    ext: payload.ext,
    protocol: payload.protocol,
    acodec: payload.acodec,
    vcodec: payload.vcodec,
  };
}

export function normalizeYtDlpMedia(payload: YtDlpPayload): ResolvedMedia | null {
  const provider = providerLabelFromYtDlp(payload);
  const candidates = [
    topLevelPayloadToFormat(payload),
    ...(payload.formats ?? []),
  ]
    .filter((format): format is YtDlpFormat => Boolean(format))
    .filter((format) => !isUnusableBrowserFormat(format))
    .filter((format) => supportsPlayableContainer(format));

  if (!candidates.length) {
    return null;
  }

  const bestFormat = [...candidates].sort(
    (left, right) => scorePlayableFormat(right) - scorePlayableFormat(left),
  )[0];

  if (!bestFormat?.url) {
    return null;
  }

  return asPlayableVideoUrl(bestFormat.url, provider, "yt-dlp");
}

async function runYtDlp(value: string) {
  const ytDlpPath = resolveYtDlpPath();
  const denoPath = resolveDenoPath();
  const denoDir = path.dirname(denoPath);
  const serverEnv = getServerEnv();
  const cookieArgs = buildYtDlpCookieArgs(serverEnv);

  if (serverEnv.YT_DLP_COOKIES_PATH.trim()) {
    const cookiesPath = resolveConfiguredCookiesPath(serverEnv.YT_DLP_COOKIES_PATH);
    if (!existsSync(cookiesPath)) {
      throw new Error(
        `YT_DLP_COOKIES_PATH points to a missing file: ${cookiesPath}`,
      );
    }
  }

  const env = {
    ...process.env,
    DENO_PATH: denoPath,
    PATH: `${denoDir}${path.delimiter}${process.env.PATH || ""}`,
  };

  try {
    const { stdout } = await execFileAsync(
      ytDlpPath,
      [
        "--dump-single-json",
        "--skip-download",
        "--no-playlist",
        "--no-warnings",
        "--socket-timeout",
        "15",
        "--extractor-retries",
        "1",
        "--retries",
        "1",
        ...cookieArgs,
        "--",
        value,
      ],
      {
        timeout: YT_DLP_TIMEOUT_MS,
        maxBuffer: 20 * 1024 * 1024,
        env,
        windowsHide: true,
      },
    );

    try {
      return JSON.parse(stdout.trim()) as YtDlpPayload;
    } catch {
      throw new Error("yt-dlp returned malformed JSON.");
    }
  } catch (error) {
    const stderr =
      typeof error === "object" && error && "stderr" in error
        ? String((error as { stderr?: string }).stderr || "")
        : "";
    const message =
      typeof error === "object" && error && "message" in error
        ? String((error as { message?: string }).message || "")
        : "yt-dlp failed";
    throw new Error(
      mapYtDlpFailureMessage(message, stderr, hasYtDlpCookieConfig(serverEnv)),
    );
  }
}

export async function resolveWithYtDlp(value: string) {
  const cached = getCachedYtDlpMedia(value);
  if (cached !== undefined) {
    return cached;
  }

  const payload = await runYtDlp(value);
  const media = normalizeYtDlpMedia(payload);
  setCachedYtDlpMedia(value, media, payload);
  return media;
}

export function extractYouTubeId(url: URL) {
  if (url.hostname.includes("youtu.be")) {
    return url.pathname.split("/").filter(Boolean)[0] ?? "";
  }

  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/")[2] ?? "";
  }

  return url.searchParams.get("v") ?? "";
}

export function extractYouTubeSearchResultIds(
  pageHtml: string,
  currentVideoId: string,
  limit = 8,
) {
  const maxItems = Math.min(Math.max(limit, 1), 24);
  const seen = new Set<string>(currentVideoId ? [currentVideoId] : []);
  const results: string[] = [];

  for (const match of pageHtml.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)) {
    const videoId = match[1];
    if (!videoId || seen.has(videoId)) {
      continue;
    }

    seen.add(videoId);
    results.push(videoId);

    if (results.length >= maxItems) {
      break;
    }
  }

  return results;
}

type YouTubeOEmbedPayload = {
  title?: string;
  author_name?: string;
};

export async function loadRelatedYouTubeUrls(value: string, limit = 8) {
  try {
    const url = new URL(value.trim());
    const currentVideoId = extractYouTubeId(url);

    if (!currentVideoId) {
      return [];
    }

    const oembedResponse = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        url.toString(),
      )}&format=json`,
      {
        headers: REQUEST_HEADERS,
        next: { revalidate: 600 },
      },
    );

    if (!oembedResponse.ok) {
      return [];
    }

    const oembedPayload = (await oembedResponse.json()) as YouTubeOEmbedPayload;
    const title = oembedPayload.title?.trim() ?? "";
    const authorName = oembedPayload.author_name?.trim() ?? "";
    const searchQueries = Array.from(
      new Set(
        [
          title,
          [authorName, title].filter(Boolean).join(" "),
          title ? `${title} remix` : "",
        ].filter(Boolean),
      ),
    );

    if (!searchQueries.length) {
      return [];
    }

    const relatedUrls: string[] = [];
    const seen = new Set<string>();

    for (const searchQuery of searchQueries) {
      const searchResponse = await fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(
          searchQuery,
        )}`,
        {
          headers: REQUEST_HEADERS,
          next: { revalidate: 600 },
        },
      );

      if (!searchResponse.ok) {
        continue;
      }

      const pageHtml = await searchResponse.text();
      const videoIds = extractYouTubeSearchResultIds(
        pageHtml,
        currentVideoId,
        limit,
      );

      for (const videoId of videoIds) {
        const nextUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (seen.has(nextUrl)) {
          continue;
        }

        seen.add(nextUrl);
        relatedUrls.push(nextUrl);

        if (relatedUrls.length >= limit) {
          return relatedUrls;
        }
      }
    }

    return relatedUrls;
  } catch {
    return [];
  }
}

function extractPornhubViewKey(url: URL) {
  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/").filter(Boolean)[1] ?? "";
  }

  return url.searchParams.get("viewkey") ?? "";
}

function extractXVideosId(url: URL) {
  if (url.pathname.startsWith("/embedframe/")) {
    return url.pathname.split("/").filter(Boolean)[1] ?? "";
  }

  return url.pathname.match(/video(\d+)/i)?.[1] ?? "";
}

function extractChaturbateRoom(url: URL) {
  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/").filter(Boolean)[1] ?? "";
  }

  return url.pathname.split("/").filter(Boolean)[0] ?? "";
}

function extractKickChannel(url: URL) {
  return url.pathname.split("/").filter(Boolean)[0] ?? "";
}

export function buildKnownMediaConfig(value: string, parentHost: string): ResolvedMedia | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const lowerHost = url.hostname.toLowerCase();

    if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(url.pathname)) {
      return asPlayableVideoUrl(url.toString(), "Direct media", "direct");
    }

    if (lowerHost.includes("youtube.com") || lowerHost.includes("youtu.be")) {
      const id = extractYouTubeId(url);
      return id
        ? asIframeUrl(`https://www.youtube.com/embed/${id}`, "YouTube", "embed")
        : null;
    }

    if (lowerHost.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id
        ? asIframeUrl(`https://player.vimeo.com/video/${id}`, "Vimeo", "embed")
        : null;
    }

    if (lowerHost.includes("twitch.tv")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "videos" && parts[1]) {
        return asIframeUrl(
          `https://player.twitch.tv/?video=v${parts[1]}&parent=${parentHost}`,
          "Twitch",
          "embed",
        );
      }

      if (parts[0]) {
        return asIframeUrl(
          `https://player.twitch.tv/?channel=${parts[0]}&parent=${parentHost}`,
          "Twitch",
          "embed",
        );
      }
    }

    if (lowerHost.includes("kick.com")) {
      if (lowerHost.includes("player.kick.com")) {
        return asIframeUrl(url.toString(), "Kick", "embed");
      }

      const channel = extractKickChannel(url);
      return channel
        ? asIframeUrl(`https://player.kick.com/${channel}`, "Kick", "embed")
        : null;
    }

    if (lowerHost.includes("pornhub.com")) {
      const viewKey = extractPornhubViewKey(url);
      return viewKey
        ? asIframeUrl(`https://www.pornhub.com/embed/${viewKey}`, "Pornhub", "embed")
        : null;
    }

    if (lowerHost.includes("xvideos.com")) {
      const videoId = extractXVideosId(url);
      return videoId
        ? asIframeUrl(`https://www.xvideos.com/embedframe/${videoId}`, "XVideos", "embed")
        : null;
    }

    if (lowerHost.includes("eporner.com") && url.pathname.startsWith("/embed/")) {
      return asIframeUrl(url.toString(), "Eporner", "embed");
    }

    if (lowerHost.includes("chaturbate.com")) {
      if (url.pathname.startsWith("/in/")) {
        return asIframeUrl(url.toString(), "Chaturbate", "embed");
      }

      const room = extractChaturbateRoom(url);
      return room
        ? asIframeUrl(`https://chaturbate.com/embed/${room}/`, "Chaturbate", "embed")
        : asIframeUrl(DEFAULT_CHATURBATE_EMBED_URL, "Chaturbate", "embed");
    }

    return null;
  } catch {
    return null;
  }
}

function firstMatch(text: string, patterns: RegExp[], baseUrl: string) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const rawValue = match?.[1];
    if (!rawValue) {
      continue;
    }

    const normalized = normalizeUrl(rawValue, baseUrl);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export async function extractMediaFromPage(
  value: string,
  providerLabel = "Extracted player",
) {
  const response = await fetch(value, {
    headers: REQUEST_HEADERS,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const baseUrl = response.url || value;

  const directSource = firstMatch(
    html,
    [
      /<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i,
      /<source[^>]+src=["']([^"']+\.(?:m3u8|mp4|webm|ogg|mov)[^"']*)["']/i,
      /"hlsUrl"\s*:\s*"([^"]+)"/i,
      /"playback_url"\s*:\s*"([^"]+)"/i,
      /"videoUrl"\s*:\s*"([^"]+\.(?:m3u8|mp4|webm|ogg|mov)[^"]*)"/i,
      /(https?:\\\/\\\/[^"'\\]+?\.(?:m3u8|mp4|webm|ogg|mov)[^"'\\]*)/i,
    ],
    baseUrl,
  );

  if (directSource && /\.(m3u8|mp4|webm|ogg|mov)(\?|$)/i.test(directSource)) {
    return asPlayableVideoUrl(directSource, providerLabel, "extracted");
  }

  const iframeSource = firstMatch(
    html,
    [
      /<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i,
      /"embedUrl"\s*:\s*"([^"]+)"/i,
      /<iframe[^>]+src=["']([^"']+)["']/i,
    ],
    baseUrl,
  );

  if (iframeSource) {
    return asIframeUrl(iframeSource, providerLabel, "extracted");
  }

  return null;
}

export async function resolveMediaSource(
  value: string,
  parentHost: string,
  deps: MediaResolverDeps = {},
) {
  const trimmed = value.trim();
  const direct = (deps.knownConfigBuilder ?? buildKnownMediaConfig)(
    trimmed,
    parentHost,
  );

  if (direct?.kind === "video" && direct.method === "direct") {
    return direct;
  }

  const providerHost = (() => {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const providerLabel = providerLabelForHost(providerHost);
  const ytDlpResolver = deps.resolveWithYtDlp ?? resolveWithYtDlp;
  const pageExtractor = deps.extractMediaFromPage ?? extractMediaFromPage;
  let ytDlpError: Error | null = null;

  try {
    const ytDlpMedia = await ytDlpResolver(trimmed);
    if (ytDlpMedia) {
      return ytDlpMedia;
    }
  } catch (error) {
    ytDlpError =
      error instanceof Error
        ? error
        : new Error("yt-dlp failed to resolve this URL.");
  }

  if (direct) {
    if (
      providerHost.includes("pornhub.com") ||
      providerHost.includes("xvideos.com") ||
      providerHost.includes("eporner.com") ||
      providerHost.includes("chaturbate.com")
    ) {
      const extracted = await pageExtractor(trimmed, providerLabel);
      if (extracted) {
        return extracted;
      }
    }

    return direct;
  }

  const extracted = await pageExtractor(trimmed, providerLabel);
  if (extracted) {
    return extracted;
  }

  if (ytDlpError) {
    throw ytDlpError;
  }

  return null;
}
