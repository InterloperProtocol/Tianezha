import { AutonomousDomainDoc } from "@/lib/types";
import { nowIso } from "@/lib/utils";

const DOC_PATHS = ["llms.txt", "llms-full.txt", "install.md"] as const;
const DOC_CACHE_MS = 30 * 60_000;

type CachedDoc = {
  expiresAt: number;
  value: AutonomousDomainDoc | null;
};

const DOC_CACHE = new Map<string, CachedDoc>();

function normalizeHost(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function summarizeDocText(text: string) {
  const cleaned = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("```"))
    .slice(0, 12)
    .join(" ");

  if (!cleaned) {
    return "Agent-ready docs were detected, but the extracted body was empty.";
  }

  const words = cleaned.split(/\s+/).slice(0, 42);
  return words.join(" ");
}

async function fetchDoc(host: string, pathName: (typeof DOC_PATHS)[number]) {
  const url = `https://${host}/${pathName}`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain, text/markdown;q=0.9, */*;q=0.1",
      "User-Agent": "Tianshi Docs Probe/1.0",
    },
    signal: AbortSignal.timeout(6_000),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const text = (await response.text()).trim();
  if (!text) {
    return null;
  }

  return {
    domain: host,
    fetchedAt: nowIso(),
    source: pathName,
    summary: summarizeDocText(text),
    url,
  } satisfies AutonomousDomainDoc;
}

export async function extractDomainDoc(input: string) {
  const host = normalizeHost(input);
  if (!host) {
    return null;
  }

  const cached = DOC_CACHE.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  for (const pathName of DOC_PATHS) {
    try {
      const value = await fetchDoc(host, pathName);
      if (value) {
        DOC_CACHE.set(host, {
          expiresAt: Date.now() + DOC_CACHE_MS,
          value,
        });
        return value;
      }
    } catch {
      continue;
    }
  }

  DOC_CACHE.set(host, {
    expiresAt: Date.now() + 5 * 60_000,
    value: null,
  });
  return null;
}

export async function extractDomainDocs(inputs: string[], limit = 3) {
  const uniqueHosts = [...new Set(inputs.map(normalizeHost).filter(Boolean))].slice(0, limit);
  const results = await Promise.allSettled(uniqueHosts.map((host) => extractDomainDoc(host)));

  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}
