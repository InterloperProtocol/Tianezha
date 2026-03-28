# Payment Adapters

Mesh coordination is native. Settlement is adapter-based.

## Shipped Adapters

- `x402`
- `manual_invoice`
- `solana_memo`
- `btc_watcher`
- `xmr_watcher`
- `conway`

## Defaults

- baseline node operation requires no wallet connect
- spot compute can run in simulation mode with no live adapter
- `x402`, `manual_invoice`, and `solana_memo` are the first real paths
- `btc_watcher` and `xmr_watcher` are config-gated
- `conway` is optional everywhere

The canonical adapter interface lives in `packages/core/src/protocol.ts` and concrete adapters live in `packages/adapters/src/payments/`.
