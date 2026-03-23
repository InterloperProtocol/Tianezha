import { lookup } from "dns/promises";
import { isIP } from "net";

import { getServerEnv } from "@/lib/env";
import {
  getPersistedRateLimitEntry,
  setPersistedRateLimitEntry,
} from "@/lib/server/policy-runtime-store";

function getRequestFingerprint(request: Request, discriminator?: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown-ua";

  return [forwardedFor || realIp || "unknown-ip", discriminator || "anonymous", userAgent]
    .filter(Boolean)
    .join(":");
}

function normalizeOriginValue(rawOrigin: string) {
  try {
    const parsed = new URL(rawOrigin);
    const isDefaultPort =
      (parsed.protocol === "https:" && (!parsed.port || parsed.port === "443")) ||
      (parsed.protocol === "http:" && (!parsed.port || parsed.port === "80"));

    return `${parsed.protocol}//${parsed.hostname}${isDefaultPort ? "" : `:${parsed.port}`}`.toLowerCase();
  } catch {
    return null;
  }
}

function getFirstForwardedValue(rawValue: string | null) {
  return rawValue?.split(",")[0]?.trim() || null;
}

function getAllowedMutationOrigins(request: Request) {
  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set<string>();
  const directOrigin = normalizeOriginValue(requestUrl.origin);
  if (directOrigin) {
    allowedOrigins.add(directOrigin);
  }

  const forwardedHost = getFirstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto =
    getFirstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(/:$/, "");

  if (forwardedHost && forwardedProto) {
    const forwardedOrigin = normalizeOriginValue(
      `${forwardedProto}://${forwardedHost}`,
    );
    if (forwardedOrigin) {
      allowedOrigins.add(forwardedOrigin);
    }
  }

  return allowedOrigins;
}

export function assertSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  const allowedOrigins = getAllowedMutationOrigins(request);
  const normalizedOrigin = origin ? normalizeOriginValue(origin) : null;

  if (origin && (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin))) {
    throw new Error("Cross-origin state changes are not allowed");
  }

  if (!origin && fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new Error("Cross-site state changes are not allowed");
  }
}

function isLoopbackIpv4(ip: string) {
  return ip.startsWith("127.");
}

function isPrivateIpv4(ip: string) {
  const octets = ip.split(".").map((value) => Number.parseInt(value, 10));
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value))) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    isLoopbackIpv4(ip) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isBlockedIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function isMetadataAddress(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "169.254.169.254" ||
    normalized === "::ffff:169.254.169.254"
  );
}

function isBlockedAddress(ip: string, allowLocalNetwork: boolean) {
  if (isMetadataAddress(ip)) {
    return true;
  }

  if (ip.includes(":")) {
    return !allowLocalNetwork && isBlockedIpv6(ip);
  }

  return !allowLocalNetwork && isPrivateIpv4(ip);
}

type SafeExternalHttpUrlOptions = {
  allowLocalNetwork?: boolean;
  label?: string;
};

function normalizeHttpUrl(rawUrl: string, label: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`${label} must be a valid absolute URL`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} must use http or https`);
  }

  if (!parsed.hostname) {
    throw new Error(`${label} must include a hostname`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not embed credentials in the URL`);
  }

  parsed.hash = "";
  return parsed;
}

export async function assertSafeExternalHttpUrl(
  rawUrl: string,
  options: SafeExternalHttpUrlOptions = {},
) {
  const label = options.label?.trim() || "URL";
  const parsed = normalizeHttpUrl(rawUrl, label);
  const hostname = parsed.hostname.toLowerCase();
  const allowLocalNetwork = options.allowLocalNetwork ?? false;

  if (hostname === "metadata.google.internal") {
    throw new Error(`${label} must not target cloud metadata hosts`);
  }

  if (
    (hostname === "localhost" || hostname.endsWith(".localhost")) &&
    !allowLocalNetwork
  ) {
    throw new Error(`${label} must not target localhost`);
  }

  if (isIP(hostname)) {
    if (isBlockedAddress(hostname, allowLocalNetwork)) {
      throw new Error(`${label} must not target private or metadata addresses`);
    }

    return parsed.toString();
  }

  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length) {
      throw new Error(`${label} hostname did not resolve`);
    }

    if (resolved.some((entry) => isBlockedAddress(entry.address, allowLocalNetwork))) {
      throw new Error(`${label} must not resolve to private or metadata addresses`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("must not")) {
      throw error;
    }

    throw new Error(`${label} could not be resolved safely`);
  }

  return parsed.toString();
}

export async function assertSafeRestEndpointUrl(rawUrl: string) {
  return assertSafeExternalHttpUrl(rawUrl, {
    allowLocalNetwork: getServerEnv().NODE_ENV !== "production",
    label: "REST device endpoint",
  });
}

export function enforceRequestRateLimit(args: {
  request: Request;
  scope: string;
  max: number;
  windowMs: number;
  discriminator?: string;
}) {
  const now = Date.now();
  const key = `${args.scope}:${getRequestFingerprint(args.request, args.discriminator)}`;
  const current = getPersistedRateLimitEntry(key, now);

  if (!current || current.resetAt <= now) {
    setPersistedRateLimitEntry(
      key,
      {
        count: 1,
        resetAt: now + args.windowMs,
      },
      now,
    );
    return;
  }

  if (current.count >= args.max) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );
    const error = new Error(
      `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
    );
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds =
      retryAfterSeconds;
    throw error;
  }

  setPersistedRateLimitEntry(
    key,
    {
      count: current.count + 1,
      resetAt: current.resetAt,
    },
    now,
  );
}

export function getRateLimitRetryAfterSeconds(error: unknown) {
  return typeof (error as { retryAfterSeconds?: unknown })?.retryAfterSeconds === "number"
    ? ((error as { retryAfterSeconds: number }).retryAfterSeconds)
    : null;
}
