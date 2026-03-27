import { AutonomousPassiveWatchlistEntry } from "@/lib/types";

const X_HANDLE_REFERENCES = [
  "UwUDelve",
  "EKaon_terminal",
  "GPlanckAI",
  "QypherAI",
  "ASIMOGHUB",
  "TheARCReality",
  "DelveAssembly",
  "GendelveCEX",
] as const;

const TOKEN_REFERENCES = [
  {
    symbol: "BURZEN",
    url: "https://dexscreener.com/solana/47sxex818tn69y2unypmgezerlttdw8ehe6utmq3uwvc",
  },
  {
    symbol: "EKAON",
    url: "https://dexscreener.com/solana/hfl7jz58dkyvms1znpwsszea5wvxx4v3knrycquq4xeb",
  },
  {
    symbol: "GPLANCK",
    url: "https://dexscreener.com/solana/ycjktszuhwxj7twwvqnmt31ushdthgwbhar8vgakr6z",
  },
  {
    symbol: "MUON",
    url: "https://dexscreener.com/solana/ek2jy6qw6g5rvkq9ihwakhrxgxzduwnvz1vxji5kznmz",
  },
  {
    symbol: "GLUON",
    url: "https://dexscreener.com/solana/hca2945pp8ssxrjld6tfanzgmhqevjtqoeekmdh6cllr",
  },
  {
    symbol: "HTAU",
    url: "https://dexscreener.com/solana/cracrgawrpshzi8c77pcktnphhqcseucsgbe8ouydyhz",
  },
  {
    symbol: "QUVIT",
    url: "https://pump.fun/NH9NbZP7WS8HzemYcWQBAjns6nNGryBd9YBQoxppump",
  },
  {
    symbol: "MTHETA",
    url: "https://x.com/GendelveCEX",
  },
] as const;

export function getAutonomousPassiveWatchlistMetadata(): AutonomousPassiveWatchlistEntry[] {
  return [
    ...X_HANDLE_REFERENCES.map((handle) => ({
      id: `x-${handle.toLowerCase()}`,
      kind: "x_handle" as const,
      label: `X handle @${handle}`,
      notes:
        "Passive watchlist metadata from the brief. Non-executable and not an ownership claim.",
      reference: `@${handle}`,
      url: `https://x.com/${handle}`,
    })),
    ...TOKEN_REFERENCES.map((token) => ({
      id: `token-${token.symbol.toLowerCase()}`,
      kind: "token" as const,
      label: `Token reference ${token.symbol}`,
      notes:
        "Passive token/reference metadata from the brief. Non-executable and not a trade instruction.",
      reference: token.symbol,
      url: token.url,
    })),
  ];
}
