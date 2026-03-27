import { extractDomainDocs } from "@/lib/server/tianshi-llm-docs";
import {
  fetchSmartWalletIntel,
} from "@/lib/server/tianshi-smart-wallets";
import { getTrenchesPulse } from "@/lib/server/trenches";
import {
  AutonomousMarketIntelStatus,
  AutonomousTapeItem,
  AutonomousWalletAnalytics,
  MarketTradeCard,
} from "@/lib/types";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tradeCardKey(card: MarketTradeCard) {
  return `${card.mint}:${card.signalScore}:${Math.round(card.marketCapUsd)}`;
}

function scoreTradeCard(args: {
  boostScore: number;
  liquidityUsd: number;
  priceChange24hPct: number;
  recentPostCount: number;
  volume24hUsd: number;
  walletCount: number;
}) {
  const volumeScore = Math.min(20, args.volume24hUsd / 50_000);
  const liquidityScore = Math.min(18, args.liquidityUsd / 20_000);
  const socialScore = Math.min(14, args.recentPostCount * 3 + args.boostScore);
  const walletScore = Math.min(28, args.walletCount * 12);
  const momentumScore = clamp(args.priceChange24hPct / 2, -8, 16);

  return Math.round(clamp(22 + volumeScore + liquidityScore + socialScore + walletScore + momentumScore, 1, 99));
}

function buildHeadline(card: {
  socialHandle?: string;
  symbol: string;
  walletCount: number;
}) {
  if (card.walletCount > 0) {
    return `${card.symbol} is pulling smart-wallet attention back into the tape`;
  }

  if (card.socialHandle) {
    return `${card.symbol} is picking up social velocity around @${card.socialHandle}`;
  }

  return `${card.symbol} is surfacing as a live trench candidate`;
}

function buildWalletCountMap(
  cards: Array<{ address: string; symbol: string }>,
  analytics: AutonomousWalletAnalytics[],
  trackedWallets: Array<{ notableMints: string[]; holdings: string[] }>,
) {
  const countByMint = new Map<string, number>();
  const countBySymbol = new Map<string, number>();

  for (const wallet of trackedWallets) {
    for (const mint of wallet.notableMints) {
      countByMint.set(mint, (countByMint.get(mint) ?? 0) + 1);
    }
    for (const symbol of wallet.holdings) {
      countBySymbol.set(symbol, (countBySymbol.get(symbol) ?? 0) + 1);
    }
  }

  for (const entry of analytics) {
    for (const moment of entry.memorableMoments) {
      const symbol = cards.find((card) => moment.includes(card.symbol))?.symbol;
      if (symbol) {
        countBySymbol.set(symbol, (countBySymbol.get(symbol) ?? 0) + 1);
      }
    }
  }

  return {
    forCard(card: { address: string; symbol: string }) {
      return Math.max(
        countByMint.get(card.address) ?? 0,
        countBySymbol.get(card.symbol.toUpperCase()) ?? 0,
      );
    },
  };
}

function buildTape(args: {
  docs: AutonomousMarketIntelStatus["docs"];
  topMessages: string[];
  tradeCards: MarketTradeCard[];
  walletAnalytics: AutonomousWalletAnalytics[];
}) {
  const tape: AutonomousTapeItem[] = [];

  for (const card of args.tradeCards.slice(0, 5)) {
    tape.push({
      detail: `${card.signalScore} score | ${round(card.marketCapUsd, 0).toLocaleString()} mc | ${card.walletCount ?? 0} wallet(s)`,
      href: card.sourceUrl || card.pairUrl || null,
      id: `market:${card.id}`,
      label: `$${card.symbol}`,
      source: "market",
    });
  }

  for (const wallet of args.walletAnalytics.slice(0, 3)) {
    tape.push({
      detail: wallet.walletMemo,
      href: null,
      id: `wallet:${wallet.wallet}`,
      label: wallet.label,
      source: "wallet",
    });
  }

  for (const message of args.topMessages.slice(0, 3)) {
    tape.push({
      detail: message,
      href: null,
      id: `x:${message.slice(0, 24)}`,
      label: "X tape",
      source: "x",
    });
  }

  for (const doc of args.docs.slice(0, 2)) {
    tape.push({
      detail: doc.summary,
      href: doc.url,
      id: `docs:${doc.domain}:${doc.source}`,
      label: doc.domain,
      source: "docs",
    });
  }

  return tape.slice(0, 12);
}

function buildSummary(args: {
  pulseSummary: string;
  topCard: MarketTradeCard | null;
  walletAnalytics: AutonomousWalletAnalytics[];
}) {
  const walletLine = args.walletAnalytics[0]?.walletMemo;
  if (!args.topCard) {
    return args.pulseSummary;
  }

  const base = `${args.topCard.symbol} leads the current heartbeat with a ${args.topCard.signalScore} signal score. ${args.topCard.summary}`;
  return walletLine ? `${base} ${walletLine}` : base;
}

export function buildMarketCardPostBody(card: MarketTradeCard) {
  const walletLine =
    card.walletCount && card.walletCount > 0
      ? `${card.walletCount} smart wallet${card.walletCount === 1 ? "" : "s"} line up behind it.`
      : "The tape is still mostly social-first, so this stays on watch.";

  return `${card.headline}. ${card.summary} Market cap ${Math.round(
    card.marketCapUsd,
  ).toLocaleString()} USD, liquidity ${Math.round(
    card.liquidityUsd,
  ).toLocaleString()} USD, 24h volume ${Math.round(
    card.volume24hUsd,
  ).toLocaleString()} USD. ${walletLine}`;
}

export async function buildAutonomousMarketIntel(
  reason: string,
  previous?: AutonomousMarketIntelStatus,
) {
  const [pulse, smartWalletIntel] = await Promise.all([
    getTrenchesPulse(),
    fetchSmartWalletIntel(6),
  ]);

  const walletCounts = buildWalletCountMap(
    pulse.tokens.map((token) => ({
      address: token.address,
      symbol: token.symbol.toUpperCase(),
    })),
    smartWalletIntel.walletAnalytics,
    smartWalletIntel.trackedWallets,
  );

  const tradeCards = pulse.tokens
    .map((token) => {
      const walletCount = walletCounts.forCard({
        address: token.address,
        symbol: token.symbol.toUpperCase(),
      });
      const signalScore = scoreTradeCard({
        boostScore: token.boostScore,
        liquidityUsd: token.liquidityUsd,
        priceChange24hPct: token.priceChange24hPct,
        recentPostCount: token.recentPosts.length,
        volume24hUsd: token.volume24hUsd,
        walletCount,
      });

      const stance =
        signalScore >= 76
          ? "bullish"
          : signalScore >= 58
            ? "watchlist"
            : "neutral";
      const summarySource = token.recentPosts[0] || token.narrative || token.description;

      return {
        headline: buildHeadline({
          socialHandle: token.twitterHandle,
          symbol: token.symbol,
          walletCount,
        }),
        id: `${token.address}:${signalScore}`,
        imageUrl: null,
        liquidityUsd: round(token.liquidityUsd),
        marketCapUsd: round(token.marketCapUsd),
        mint: token.address,
        name: token.name,
        pairUrl: token.pairUrl || null,
        priceChange24hPct: round(token.priceChange24hPct),
        signalScore,
        socialHandle: token.twitterHandle || null,
        socialUrl: token.twitterUrl || null,
        sourceLabel: pulse.sourceLabel,
        sourceUrl: token.twitterUrl || token.pairUrl || null,
        stance,
        summary: summarySource,
        symbol: token.symbol.toUpperCase(),
        volume24hUsd: round(token.volume24hUsd),
        walletCount,
      } satisfies MarketTradeCard;
    })
    .sort((left, right) => right.signalScore - left.signalScore)
    .slice(0, 8);

  const docs = await extractDomainDocs(
    pulse.tokens
      .map((token) => token.websiteUrl || token.twitterUrl || "")
      .filter(Boolean),
    3,
  );

  const topCard = tradeCards[0] ?? null;
  const summary = buildSummary({
    pulseSummary: pulse.summary,
    topCard,
    walletAnalytics: smartWalletIntel.walletAnalytics,
  });

  return {
    docs,
    heartbeatSource: reason,
    lastOutcome: topCard
      ? `Heartbeat ranked ${topCard.symbol} as the strongest live candidate.`
      : "Heartbeat refreshed tape, but no trade card qualified yet.",
    lastPostedAt: previous?.lastPostedAt ?? null,
    lastPostedTradeCardKey: previous?.lastPostedTradeCardKey ?? null,
    nextTradeCandidateMint:
      topCard && topCard.signalScore >= 58 ? topCard.mint : null,
    nextTradeCandidateSymbol:
      topCard && topCard.signalScore >= 58 ? topCard.symbol : null,
    summary,
    topTape: buildTape({
      docs,
      topMessages: smartWalletIntel.topMessages,
      tradeCards,
      walletAnalytics: smartWalletIntel.walletAnalytics,
    }),
    trackedWallets: smartWalletIntel.trackedWallets,
    tradeCards,
    updatedAt: pulse.fetchedAt,
    walletAnalytics: smartWalletIntel.walletAnalytics,
  } satisfies AutonomousMarketIntelStatus;
}

export function getTopTradeCardKey(intel: AutonomousMarketIntelStatus) {
  const topCard = intel.tradeCards[0];
  return topCard ? tradeCardKey(topCard) : null;
}
