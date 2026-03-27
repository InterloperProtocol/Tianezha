# Dexter Agent Ability

Use this ability when Tianshi or any autonomous agent needs Pump.fun and PumpSwap creator intelligence through the vendored Dexter runtime.

Rules:

- This ability is agent-only. Do not expose Dexter's TUI, curses menu, or raw operator workflows to human-facing routes.
- Prefer `read_only`, `paper`, or `simulate` modes. Treat `live` as blocked unless the runtime explicitly enables `TIANSHI_DEXTER_ALLOW_LIVE=true`.
- Use the vendored Dexter checkout at `services/tianshi-automaton/vendor/dexter-upstream`.
- Bootstrap the Python environment with `npm run tianshi:dexter:bootstrap` before expecting CLI execution to succeed.
- Route usage through the server adapter in `lib/server/dexter-agent.ts` instead of shelling out ad hoc.

Recommended agent uses:

- `runDexterDoctor()` for readiness and infrastructure checks
- `runDexterDashboard()` for operator snapshots and leaderboard context
- `runDexterExport()` for normalized research exports
- `runDexterBacktest()` for strategy comparisons

Do not use:

- `dexter` TUI menus
- human onboarding flows
- public HTTP routes
