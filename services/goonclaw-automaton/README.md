# GoonClaw Automaton Service

This directory holds the in-repo autonomous runtime assets for GoonClaw.

## Runtime goals

- Google Cloud only
- Vertex AI Gemini only
- Solana + USDC only
- Public status wall, no public chat or public controls
- Owner-only intervention through the hidden admin dashboard
- Conway domains and infrastructure access only through an allowlisted host set
- Pump meme coin trading only, capped at 10% portfolio exposure per position

## Local runtime entrypoint

Run the in-process heartbeat loop with:

```bash
npx tsx services/goonclaw-automaton/runtime-loop.ts
```

This loop is a bridge until the dedicated GCE VM is the sole runtime host.

## GCE deployment shape

- Dedicated Compute Engine VM
- `systemd` managed runtime using `deploy/gce/goonclaw-autonomous.service`
- Google service account for Vertex auth
- Local persistent `.data` state on attached disk
- Cloud Logging and Monitoring for host-level telemetry

## Bundled dependencies

- `solana-agent-kit` is the primary onchain execution layer
- `solana-mcp` is configured as an MCP bridge in [`mcp/solana-mcp.config.json`](/c:/SessionMint/BagStroker/services/goonclaw-automaton/mcp/solana-mcp.config.json)
- `sendaifun/skills` is bundled into [`vendor/sendaifun-skills-bundle`](/c:/SessionMint/BagStroker/services/goonclaw-automaton/vendor/sendaifun-skills-bundle)
- `@dexterai/x402` is installed for HTTP-native paid API access from the agent runtime through a budgeted Solana client

## Telegram relay

- GoonClaw can publish read-only runtime telemetry to Telegram
- The relay posts outbound-only feed events such as heartbeats, policy reasoning, revenue/trade updates, and burns
- No Telegram webhook or command handler is exposed by this app
- The runtime bootstraps the bot in read-only mode by clearing webhook delivery and deleting command menus before posting

## Environment

Expected environment variables include:

- `GOONCLAW_OWNER_WALLET`
- `GOONCLAW_AGENT_WALLET_SECRET`
- `GOONCLAW_AGENT_RESERVE_FLOOR_SOL`
- `GOONCLAW_MEMECOIN_MAX_PORTFOLIO_PCT`
- `SOLANA_RPC_URL`
- `VERTEX_AI_PROJECT_ID`
- `VERTEX_AI_LOCATION`
- `VERTEX_AI_MODEL`
- `GOONCLAW_SKILLS_DIR`
- `GOONCLAW_AGENT_CONSTITUTION_PATH`
- `GOONCLAW_CONWAY_ALLOWED_HOSTS`
- `GOONCLAW_TELEGRAM_BOT_TOKEN`
- `GOONCLAW_TELEGRAM_CHAT_ID`
- `GOONCLAW_TELEGRAM_THREAD_ID`
- `GOONCLAW_X402_BUDGET_USD`
- `GOONCLAW_X402_PER_REQUEST_USD`
- `GOONCLAW_X402_PER_HOUR_USD`
- `GOONCLAW_X402_ALLOWED_DOMAINS`
