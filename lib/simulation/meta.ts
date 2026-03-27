export type RankLabel =
  | "Observer"
  | "Entrant"
  | "Verified Holder"
  | "Participant"
  | "Strategist"
  | "Inner Circle"
  | "Operator Candidate";

export type BadgeCategory =
  | "Identity"
  | "Governance"
  | "Prediction"
  | "Perps"
  | "Social"
  | "Tribe"
  | "Status";

type RankStep = {
  label: RankLabel;
  minRewards: number;
  requiresVerification?: boolean;
};

export const RANK_STEPS: RankStep[] = [
  { label: "Observer", minRewards: 0 },
  { label: "Entrant", minRewards: 20 },
  { label: "Verified Holder", minRewards: 40, requiresVerification: true },
  { label: "Participant", minRewards: 120 },
  { label: "Strategist", minRewards: 300 },
  { label: "Inner Circle", minRewards: 650 },
  { label: "Operator Candidate", minRewards: 1_200 },
];

export const BADGE_CATEGORY_MAP: Record<string, BadgeCategory> = {
  "Agent sponsor": "Social",
  "GenDelve voter": "Governance",
  "Nezha pilot": "Perps",
  "Owner verified": "Identity",
  "Public poster": "Social",
  "Support verified": "Status",
  "Tianzi trader": "Prediction",
  "Verified owner": "Status",
};

export const HYBRID_FUTARCHY_WEIGHTS = {
  futarchy: 0.42,
  governance: 0.42,
  revenue: 0.16,
} as const;

export const PERCOLATOR_SAFE_COMPETITIVE_BUDGET = 2_500;

export function deriveRankLabel(args: {
  claimsUnlocked: boolean;
  totalRewards: number;
}) {
  let selected = RANK_STEPS[0];

  for (const step of RANK_STEPS) {
    if (args.totalRewards < step.minRewards) {
      continue;
    }
    if (step.requiresVerification && !args.claimsUnlocked) {
      continue;
    }
    selected = step;
  }

  return selected.label;
}

export function deriveRankNumber(args: {
  claimsUnlocked: boolean;
  totalRewards: number;
}) {
  const label = deriveRankLabel(args);
  return Math.max(
    1,
    RANK_STEPS.findIndex((step) => step.label === label) + 1,
  );
}

export function categorizeBadge(badge: string): BadgeCategory {
  return BADGE_CATEGORY_MAP[badge] || "Status";
}

export function groupBadgesByCategory(badges: string[]) {
  const grouped = new Map<BadgeCategory, string[]>();

  for (const badge of badges) {
    const category = categorizeBadge(badge);
    const current = grouped.get(category) ?? [];
    current.push(badge);
    grouped.set(category, current);
  }

  return [...grouped.entries()].map(([category, items]) => ({
    category,
    items,
  }));
}
