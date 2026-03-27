# Formulas

GovShare(chain) = chainVoteWeight / totalVoteWeight
FutarchyShare(chain) = chainPool / totalPool
RevenueShare(chain) = chainRevenue / totalRevenue

FinalScore(chain) =
- 0.42 × Governance Share
- 0.42 × Futarchy Share
- 0.16 × Revenue Share

h = min(1, SafeCompetitiveBudget / RequestedCompetitiveBudget)
EffectiveBenefit = PlannedBenefit × h
