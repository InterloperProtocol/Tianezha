# G0DM0D3 Agent Runtime

Tianezha treats G0DM0D3 as an internal agent-only cognition layer.

## What it does

- gives Tianshi and autonomous sub-agents access to G0DM0D3 model racing
- supports ULTRAPLINIAN-style selection through the configured API
- stays out of human-facing product surfaces

## Canonical adapter

- `lib/server/godmode-agent.ts`

## Environment

- `TIANSHI_GODMODE_ENABLED`
- `TIANSHI_GODMODE_API_URL`
- `TIANSHI_GODMODE_API_KEY`
- `TIANSHI_GODMODE_OPENROUTER_KEY`
- `TIANSHI_GODMODE_DEFAULT_MODEL`

## Notes

- readiness is probed from the runtime bootstrap
- the public status API strips `godmode.*` action names
- the vendored skill name is `godmode-agent`

