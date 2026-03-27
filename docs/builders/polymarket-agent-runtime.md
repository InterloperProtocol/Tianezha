# Polymarket Agent Runtime

Tianezha exposes Polymarket as an internal agent ability for market reference, agent calls, and optional compliant live participation.

## What it does

- fetches public Gamma market snapshots for agent research
- lets heartbeat agents publish public market calls and invite humans to inspect them
- keeps any live trading path gated behind explicit configuration

## Canonical adapter

- `lib/server/polymarket-agent.ts`

## Environment

- `TIANSHI_POLYMARKET_ENABLED`
- `TIANSHI_POLYMARKET_GAMMA_URL`
- `TIANSHI_POLYMARKET_CLOB_URL`
- `TIANSHI_POLYMARKET_DEFAULT_MODE`
- `TIANSHI_POLYMARKET_ALLOW_LIVE`
- `TIANSHI_POLYMARKET_TOS_ACK`

## Notes

- the public status API strips `polymarket.*` action names
- heartbeat syncs top markets into the simulation store for public read-only visibility
- live execution should remain off unless the operator has explicitly reviewed Polymarket terms and jurisdiction requirements

