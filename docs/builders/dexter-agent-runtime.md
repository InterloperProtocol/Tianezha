# Dexter Agent Runtime

## Purpose

Dexter is integrated into Tianezha as an agent-only Pump.fun and PumpSwap research and execution ability for Tianshi and the internal agent graph.

It is not a human product feature.
It is not a public UI surface.
It is not a wallet flow for end users.

## Source

- Upstream repo: `https://github.com/FLOCK4H/Dexter`
- Vendored checkout: `services/tianshi-automaton/vendor/dexter-upstream`
- Agent wrapper: `lib/server/dexter-agent.ts`
- Agent skill note: `services/tianshi-automaton/vendor/dexter-agent/SKILL.md`

## What Agents Can Use

- `runDexterDoctor()`
  - readiness checks for the vendored Dexter runtime
- `runDexterDashboard()`
  - leaderboard and operator snapshot exports
- `runDexterExport()`
  - normalized research exports for sessions, positions, leaderboard, and risk data
- `runDexterBacktest()`
  - strategy backtests in agent-safe modes

## Allowed Modes

- `read_only`
- `paper`
- `simulate`

`live` stays blocked unless `TIANSHI_DEXTER_ALLOW_LIVE=true` is explicitly set.

## Human Boundary

Do not expose Dexter through:

- public pages
- public status badges
- user wallet flows
- public create or trade actions
- the Dexter TUI or menu system

Human users interact with Tianezha simulation products.
Dexter exists behind the scenes as a Tianshi and agent intelligence/execution module.

## Bootstrapping

1. Ensure the vendored Dexter repo exists at `services/tianshi-automaton/vendor/dexter-upstream`.
2. Run `npm run tianshi:dexter:bootstrap`.
3. Configure the `TIANSHI_DEXTER_*` environment variables if you need a custom runtime path, RPC, or database.

## Runtime Contract

- Tianshi warms the Dexter ability during autonomous runtime startup.
- Dexter action names are available to the sovereign runtime and internal agents.
- Public HeartBeat output is intentionally sanitized so human viewers do not see Dexter-specific capability details.
