import { generatePublicModelText, isPublicModelConfigured } from "@/lib/server/public-model";

type DexScreenerSeedItem = {
  chainId?: string;
  tokenAddress?: string;
  description?: string | null;
  links?: Array<{
    label?: string;
    type?: string;
    url?: string;
  }> | null;
  totalAmount?: number;
  amount?: number;
};

type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  priceUsd?: string | null;
  priceChange?: {
    h24?: number;
  } | null;
  volume?: {
    h24?: number;
  } | null;
  liquidity?: {
    usd?: number;
  } | null;
  fdv?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  } | null;
  info?: {
    websites?: Array<{
      label?: string;
      url?: string;
    }> | null;
    socials?: Array<{
      type?: string;
      url?: string;
    }> | null;
    imageUrl?: string | null;
    header?: string | null;
  } | null;
  boosts?: {
    active?: number;
  } | null;
};

export interface TrenchesToken {
  address: string;
  name: string;
  symbol: string;
  dexId: string;
  pairUrl: string;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange24hPct: number;
  pairCreatedAt?: number;
  boostScore: number;
  description: string;
  twitterHandle?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  recentPosts: string[];
  narrative: string;
}

export interface TrenchesPulse {
  fetchedAt: string;
  nextRefreshAt: string;
  sourceLabel: string;
  summary: string;
  tokens: TrenchesToken[];
}

const TRENCHES_CACHE_MS = 10 * 60_000;
const MIN_MARKET_CAP_USD = 100_000;
const MAX_TOKENS = 10;
const SEED_LIMIT = 60;
const TRENCHES_CACHE = new Map<string, { expiresAt: number; value: TrenchesPulse }>();
const DEX_API_BASE = "https://api.dexscreener.com";
const JINA_READER_BASE = "https://r.jina.ai/http://x.com";

export function buildUnavailableTrenchesPulse(message?: string): TrenchesPulse {
  const fetchedAt = new Date();

  return {
    fetchedAt: fetchedAt.toISOString(),
    nextRefreshAt: new Date(fetchedAt.getTime() + TRENCHES_CACHE_MS).toISOString(),
    sourceLabel: "DexScreener public market pulse",
    summary:
      message ||
      "The trench monitor hit a temporary data issue, so the panel is holding a safe standby summary until the next refresh.",
    tokens: [],
  };
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function fetchJson<T>(url: string, timeoutMs = 10_000) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "GoonClaw Trench Monitor/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return (await response.json()) as T;
}

function dedupeSeedItems(items: DexScreenerSeedItem[]) {
  const seen = new Set<string>();
  const next: DexScreenerSeedItem[] = [];

  for (const item of items) {
    const tokenAddress = item.tokenAddress?.trim();
    if (!tokenAddress || item.chainId !== "solana" || seen.has(tokenAddress)) {
      continue;
    }

    seen.add(tokenAddress);
    next.push(item);
  }

  return next.slice(0, SEED_LIMIT);
}

async function fetchSeedItems() {
  const endpoints = [
    "/token-boosts/top/v1",
    "/token-boosts/latest/v1",
    "/community-takeovers/latest/v1",
    "/token-profiles/latest/v1",
  ];

  const results = await Promise.allSettled(
    endpoints.map((endpoint) =>
      fetchJson<DexScreenerSeedItem[]>(`${DEX_API_BASE}${endpoint}`),
    ),
  );

  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  return dedupeSeedItems(items);
}

function selectBestPair(pairs: DexScreenerPair[]) {
  return [...pairs].sort((left, right) => {
    const rightScore =
      (right.marketCap ?? right.fdv ?? 0) * 10 +
      (right.liquidity?.usd ?? 0) * 3 +
      (right.volume?.h24 ?? 0);
    const leftScore =
      (left.marketCap ?? left.fdv ?? 0) * 10 +
      (left.liquidity?.usd ?? 0) * 3 +
      (left.volume?.h24 ?? 0);

    return rightScore - leftScore;
  })[0] ?? null;
}

function isLikelyPumpToken(pair: DexScreenerPair, seed?: DexScreenerSeedItem) {
  const address = pair.baseToken?.address?.toLowerCase() ?? "";
  if (address.endsWith("pump")) {
    return true;
  }

  const seedLinks = seed?.links ?? [];
  const websiteLinks = pair.info?.websites ?? [];
  const socialLinks = pair.info?.socials ?? [];
  const urls = [
    ...seedLinks.map((item) => item.url ?? ""),
    ...websiteLinks.map((item) => item.url ?? ""),
    ...socialLinks.map((item) => item.url ?? ""),
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  return urls.some((url) => url.includes("pump.fun"));
}

function extractLinkUrls(pair: DexScreenerPair, seed?: DexScreenerSeedItem) {
  return [
    ...(seed?.links ?? []),
    ...(pair.info?.websites ?? []),
    ...(pair.info?.socials ?? []),
  ]
    .map((item) => item.url?.trim() ?? "")
    .filter(Boolean);
}

export function extractTwitterHandleFromUrls(urls: string[]) {
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      if (!hostname.includes("x.com") && !hostname.includes("twitter.com")) {
        continue;
      }

      const [firstPath] = parsed.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean);
      if (!firstPath) {
        continue;
      }

      if (
        ["home", "search", "i", "intent", "share", "status"].includes(
          firstPath.toLowerCase(),
        )
      ) {
        continue;
      }

      return firstPath.replace(/^@/, "");
    } catch {
      continue;
    }
  }

  return undefined;
}

function cleanPostLine(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractRecentPostSnippets(markdown: string, maxPosts = 10) {
  const postsSectionIndex = markdown.indexOf("## ");
  const relevant = postsSectionIndex >= 0 ? markdown.slice(postsSectionIndex) : markdown;
  const lines = relevant
    .split("\n")
    .map(cleanPostLine)
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith("## ") &&
        !line.startsWith("Title:") &&
        !line.startsWith("URL Source:") &&
        !line.startsWith("Published Time:") &&
        line !== "Markdown Content:" &&
        line !== "Quote" &&
        line !== "Pinned" &&
        !/^@[A-Za-z0-9_]+$/.test(line) &&
        !/^\d+(?:\.\d+)?[KMB]?$/.test(line) &&
        !/^(Following|Followers|Posts|Replies|Highlights|Media)$/.test(line),
    );

  const snippets: string[] = [];
  for (const line of lines) {
    if (line.length < 24) {
      continue;
    }

    if (snippets.includes(line)) {
      continue;
    }

    snippets.push(line);
    if (snippets.length >= maxPosts) {
      break;
    }
  }

  return snippets;
}

async function fetchRecentPostsForHandle(handle: string) {
  try {
    const response = await fetch(`${JINA_READER_BASE}/${handle}`, {
      headers: {
        Accept: "text/plain",
        "User-Agent": "GoonClaw Trench Monitor/1.0",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const markdown = await response.text();
    return extractRecentPostSnippets(markdown, 10);
  } catch {
    return [];
  }
}

function topKeywords(values: string[], maxKeywords = 6) {
  const stopWords = new Set([
    "about",
    "again",
    "agent",
    "because",
    "being",
    "build",
    "built",
    "chain",
    "coin",
    "coins",
    "community",
    "crypto",
    "have",
    "just",
    "like",
    "market",
    "meme",
    "more",
    "pump",
    "project",
    "really",
    "solana",
    "still",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "token",
    "tokens",
    "very",
    "with",
    "your",
  ]);

  const counts = new Map<string, number>();

  for (const value of values) {
    const words = value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !stopWords.has(word));

    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

export function buildFallbackTrenchesSummary(tokens: TrenchesToken[]) {
  if (!tokens.length) {
    return "No trench-ready tokens cleared the current filters yet. Check back on the next refresh.";
  }

  const keywords = topKeywords(
    tokens.flatMap((token) => [token.description, ...token.recentPosts]),
  );
  const leaders = tokens
    .slice(0, 3)
    .map((token) => token.symbol)
    .join(", ");
  const keywordSummary = keywords.length
    ? `Common themes right now: ${keywords.join(", ")}.`
    : "The current pulse is leaning more on momentum and branding than a single dominant story.";

  return `${leaders} are leading the current trench pulse. ${keywordSummary} Watch for tokens that pair fresh social energy with sustained liquidity over $100k market cap.`;
}

async function buildNarrativeSummary(tokens: TrenchesToken[]) {
  if (!tokens.length) {
    return buildFallbackTrenchesSummary(tokens);
  }

  if (!isPublicModelConfigured()) {
    return buildFallbackTrenchesSummary(tokens);
  }

  const prompt = [
    "You are writing a fast market pulse for a public Solana meme dashboard.",
    "Summarize the narratives and tech themes in 3 concise sentences.",
    "Do not mention admin tools, backend systems, or say you are an AI.",
    "Focus on what feels interesting in the trenches right now.",
    "",
    "Token data:",
    JSON.stringify(
      tokens.map((token) => ({
        symbol: token.symbol,
        name: token.name,
        marketCapUsd: token.marketCapUsd,
        volume24hUsd: token.volume24hUsd,
        priceChange24hPct: token.priceChange24hPct,
        description: token.description,
        recentPosts: token.recentPosts.slice(0, 5),
      })),
    ),
  ].join("\n");

  try {
    return await generatePublicModelText(prompt, {
      temperature: 0.35,
      maxOutputTokens: 220,
    });
  } catch {
    return buildFallbackTrenchesSummary(tokens);
  }
}

async function buildTrenchesTokens() {
  const seeds = await fetchSeedItems();
  if (!seeds.length) {
    return [];
  }

  const tokenAddresses = seeds
    .map((seed) => seed.tokenAddress?.trim() ?? "")
    .filter(Boolean);

  const pairResults = await Promise.allSettled(
    chunk(tokenAddresses, 30).map((group) =>
      fetchJson<DexScreenerPair[]>(
        `${DEX_API_BASE}/tokens/v1/solana/${group.join(",")}`,
      ),
    ),
  );

  const pairs = pairResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const pairsByAddress = new Map<string, DexScreenerPair[]>();

  for (const pair of pairs) {
    const address = pair.baseToken?.address;
    if (!address) {
      continue;
    }

    const existing = pairsByAddress.get(address) ?? [];
    existing.push(pair);
    pairsByAddress.set(address, existing);
  }

  const shortlisted: TrenchesToken[] = seeds
    .map((seed): TrenchesToken | null => {
      const address = seed.tokenAddress?.trim();
      if (!address) {
        return null;
      }

      const bestPair = selectBestPair(pairsByAddress.get(address) ?? []);
      if (!bestPair || !isLikelyPumpToken(bestPair, seed)) {
        return null;
      }

      const marketCap = bestPair.marketCap ?? bestPair.fdv ?? 0;
      if (marketCap < MIN_MARKET_CAP_USD) {
        return null;
      }

      const urls = extractLinkUrls(bestPair, seed);
      const twitterHandle = extractTwitterHandleFromUrls(urls);
      const twitterUrl = twitterHandle ? `https://x.com/${twitterHandle}` : undefined;
      const websiteUrl = urls.find(
        (url) =>
          !url.includes("pump.fun") &&
          !url.includes("x.com/") &&
          !url.includes("twitter.com/") &&
          !url.includes("t.me/"),
      );

      return {
        address,
        name: bestPair.baseToken?.name?.trim() || "Unknown",
        symbol: bestPair.baseToken?.symbol?.trim() || "TOKEN",
        dexId: bestPair.dexId?.trim() || "solana",
        pairUrl: bestPair.url?.trim() || "",
        marketCapUsd: marketCap,
        liquidityUsd: bestPair.liquidity?.usd ?? 0,
        volume24hUsd: bestPair.volume?.h24 ?? 0,
        priceChange24hPct: bestPair.priceChange?.h24 ?? 0,
        pairCreatedAt: bestPair.pairCreatedAt ?? undefined,
        boostScore: seed.totalAmount ?? seed.amount ?? bestPair.boosts?.active ?? 0,
        description: seed.description?.trim() || "",
        twitterHandle,
        twitterUrl,
        websiteUrl,
        recentPosts: [],
        narrative: "",
      };
    })
    .filter((item): item is TrenchesToken => item !== null)
    .sort((left, right) => {
      if (right.marketCapUsd !== left.marketCapUsd) {
        return right.marketCapUsd - left.marketCapUsd;
      }

      if (right.volume24hUsd !== left.volume24hUsd) {
        return right.volume24hUsd - left.volume24hUsd;
      }

      return right.boostScore - left.boostScore;
    })
    .slice(0, MAX_TOKENS);

  const withPosts = await Promise.all(
    shortlisted.map(async (token): Promise<TrenchesToken> => {
      const recentPosts = token.twitterHandle
        ? await fetchRecentPostsForHandle(token.twitterHandle)
        : [];
      const narrativeSource = [
        token.description,
        ...recentPosts.slice(0, 4),
      ]
        .map((value) => value.trim())
        .filter(Boolean);

      return {
        ...token,
        recentPosts,
        narrative:
          narrativeSource[0] ||
          "Fresh activity is showing up on the chart, but the social story is still thin.",
      };
    }),
  );

  return withPosts;
}

export async function getTrenchesPulse() {
  const cacheKey = "pulse";
  const cached = TRENCHES_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const fetchedAt = new Date();
    const tokens = await buildTrenchesTokens();
    const summary = await buildNarrativeSummary(tokens);
    const sourceLabel = "DexScreener public market pulse";
    const value = {
      fetchedAt: fetchedAt.toISOString(),
      nextRefreshAt: new Date(fetchedAt.getTime() + TRENCHES_CACHE_MS).toISOString(),
      sourceLabel,
      summary,
      tokens,
    } satisfies TrenchesPulse;

    TRENCHES_CACHE.set(cacheKey, {
      expiresAt: fetchedAt.getTime() + TRENCHES_CACHE_MS,
      value,
    });

    return value;
  } catch (error) {
    const fallback = buildUnavailableTrenchesPulse(
      error instanceof Error
        ? `The trench monitor hit a temporary data issue: ${error.message}`
        : undefined,
    );

    TRENCHES_CACHE.set(cacheKey, {
      expiresAt: Date.now() + 60_000,
      value: fallback,
    });

    return fallback;
  }
}
