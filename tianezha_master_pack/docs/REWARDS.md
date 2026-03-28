# Rewards

Rewards are offchain and simulation-first by default.

Pool policy:

- total rewards pool is fixed at `49%`
- inside that pool `51%` is token-holder-proportional
- inside that pool `21%` is `proof_of_compute`
- inside that pool `28%` is remaining user lanes such as proof-of-loss, participation, and in-game activity

Reward classes:

1. `simulated`
2. `in_game`
3. `settled`

Doctrine:

- `proof_of_compute` is contribution accounting, not mining
- no new chain is required for the reward system
- no new token is required for the reward system
- compute jobs, vendor work, and user participation can all feed the offchain ledger
