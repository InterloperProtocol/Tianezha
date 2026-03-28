# Rewards

The canonical reward ledger lives in `packages/core/src/rewards.ts`.

## Policy

- rewards stay offchain and simulated by default
- no new chain is required
- no new token is required
- `proof_of_compute` is contribution accounting, not mining

## Pool Split

Tianezha locks the total rewards pool at `49%`. Inside that pool:

- `51%` goes to token-holder-proportional rewards
- `21%` goes to `proof_of_compute`
- `28%` goes to remaining user lanes

## Reward Classes

- `simulated`
- `in_game`
- `settled`

## Current Runtime Use

`lib/server/mesh-commerce.ts` records proof-of-compute rewards from completed native spot assignments and exposes the summarized lanes through the autonomous status surface.
