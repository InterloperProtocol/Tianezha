# Native Compute Market

The executable market in Tianezha is the native spot compute market in `packages/core/src/computeMarket.ts`.

## Scope

- compute
- prompt processing
- model execution
- storage
- preservation
- task execution

## Matching Rule

Matching is deterministic:

1. lowest unit price that satisfies the request wins
2. ties break by higher reliability score
3. remaining ties break by lower latency

This keeps the market legible for humans, predictable for agents, and easy to replay from saved state.

## Settlement

- coordination is native to the mesh
- settlement is adapter-based
- spot jobs can run in fully simulated mode with no settlement adapter enabled
- v1 real adapters are `x402`, `manual_invoice`, and `solana_memo`
- `btc_watcher` and `xmr_watcher` are provider-backed optional adapters
- `conway` stays optional and never blocks compute execution

## Reference Prices

Spot execution is real. Price discovery is blended in `packages/core/src/computePriceMarkets.ts`:

- `spotIndex`: rolling VWAP plus executable depth
- `perpMark`: Nezha compute-cost perp mark
- `forecastPrice`: Tianzi compute-cost expected price
- `referencePrice = 0.60 * spotIndex + 0.25 * perpMark + 0.15 * forecastPrice`

If perps or forecasts are disabled or illiquid, the reference layer falls back toward spot-only pricing.
