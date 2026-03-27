# Tianshi Automaton Service

This directory holds the in-repo autonomous runtime assets for Tianshi.

## Runtime goals

- Google Cloud primary runtime
- Vertex AI Gemini only
- Solana-native only, with SOL reserve tracking and USDC-denominated runtime accounting where applicable
- Public status wall, no public controls of the sovereign runtime
- Any public or personal chat surface must remain separate from the sovereign runtime and may not access admin or treasury controls
- Owner-only intervention through the hidden admin dashboard
- Conway domains and infrastructure access only through an allowlisted host set when Google-native routing is insufficient
- Conway Terminal available to Codex as a fallback path through [`mcp/conway-codex.config.json`](/c:/SessionMint/BagStroker/services/tianshi-automaton/mcp/conway-codex.config.json)
- Tavily, Context7, Task Master, Excel, Helius Docs, and Playwright are bundled into the consolidated Codex manifest at [`mcp/tianshi-codex.config.json`](/c:/SessionMint/BagStroker/services/tianshi-automaton/mcp/tianshi-codex.config.json)
- Pump meme coin trading only, capped at 10% portfolio exposure per position
- Live replica child spawning with no numeric cap, so long as children inherit the same constitution path and runtime envelope

## Canonical policy docs

- `../../docs/CONSTITUTION.md` is the canonical constitutional charter for the repo
- `../../docs/ECONOMIC_POLICY.md` is the canonical treasury and revenue policy for the repo
- local `constitution.md` and `economic-policy.md` files in this folder are compatibility pointers for older tooling
- app-level Agent Ops, cNFT, and LaunchONomics settings elsewhere in the repo are adjacent product economics unless explicitly wired into the autonomous runtime

## Local runtime entrypoint

Run the in-process heartbeat loop with:

```bash
npx tsx services/tianshi-automaton/runtime-loop.ts
```

This loop is a bridge until the dedicated GCE VM is the primary runtime host.

For Codex plus the full Tianshi MCP stack, start Codex with:

```bash
codex --mcp-config services/tianshi-automaton/mcp/tianshi-codex.config.json
```

## GCE deployment shape

- Dedicated Compute Engine VM
- `systemd` managed runtime using `deploy/gce/tianshi-autonomous.service`
- Google service account for Vertex auth
- Local persistent `.data` state on attached disk
- Cloud Logging and Monitoring for host-level telemetry
- Conway Terminal only as secondary/fallback infrastructure when the Google-hosted path is insufficient

## Bundled dependencies

- `solana-agent-kit` is the primary onchain execution layer
- `solana-mcp` is configured as an MCP bridge in [`mcp/solana-mcp.config.json`](/c:/SessionMint/BagStroker/services/tianshi-automaton/mcp/solana-mcp.config.json)
- `conway-terminal` is wired for Codex fallback use through [`mcp/conway-codex.config.json`](/c:/SessionMint/BagStroker/services/tianshi-automaton/mcp/conway-codex.config.json)
- `tavily-mcp`, `@upstash/context7-mcp`, `task-master-ai`, and `excel-mcp-server` are declared under [`mcp/tianshi-codex.config.json`](/c:/SessionMint/BagStroker/services/tianshi-automaton/mcp/tianshi-codex.config.json) with per-server references in the same folder
- official Anthropic workflow packs are vendored in [`vendor/anthropic-skills`](/c:/SessionMint/BagStroker/services/tianshi-automaton/vendor/anthropic-skills)
- `sendaifun/skills` is bundled into [`vendor/sendaifun-skills-bundle`](/c:/SessionMint/BagStroker/services/tianshi-automaton/vendor/sendaifun-skills-bundle)
- `@dexterai/x402` is installed for HTTP-native paid API access from the agent runtime through a budgeted Solana client
- FLOCK4H Dexter is vendored in [`vendor/dexter-upstream`](/c:/SessionMint/Tianezha/services/tianshi-automaton/vendor/dexter-upstream) and exposed through the agent-only adapter at [`../../lib/server/dexter-agent.ts`](/c:/SessionMint/Tianezha/lib/server/dexter-agent.ts)
- bootstrap Dexter's Python environment with `npm run tianshi:dexter:bootstrap`
- elder-plinius G0DM0D3 is vendored in [`vendor/g0dm0d3-upstream`](/c:/SessionMint/Tianezha/services/tianshi-automaton/vendor/g0dm0d3-upstream) and exposed through the agent-only adapter at [`../../lib/server/godmode-agent.ts`](/c:/SessionMint/Tianezha/lib/server/godmode-agent.ts)
- Polymarket Agents is vendored in [`vendor/polymarket-agents-upstream`](/c:/SessionMint/Tianezha/services/tianshi-automaton/vendor/polymarket-agents-upstream) and exposed through the agent-only adapter at [`../../lib/server/polymarket-agent.ts`](/c:/SessionMint/Tianezha/lib/server/polymarket-agent.ts)

## Telegram relay

- Tianshi can publish read-only runtime telemetry to Telegram
- The relay posts outbound-only feed events such as heartbeats, policy reasoning, revenue/trade updates, and burns
- No Telegram webhook or command handler is exposed by this app
- The runtime bootstraps the bot in read-only mode by clearing webhook delivery and deleting command menus before posting

## Environment

Expected environment variables include:

- `TIANSHI_OWNER_WALLET`
- `TIANSHI_AGENT_WALLET_SECRET`
- `TIANSHI_AGENT_RESERVE_FLOOR_SOL`
- `TIANSHI_MEMECOIN_MAX_PORTFOLIO_PCT`
- `SOLANA_RPC_URL`
- `VERTEX_AI_PROJECT_ID`
- `VERTEX_AI_LOCATION`
- `VERTEX_AI_MODEL`
- `TIANSHI_SKILLS_DIR`
- `TIANSHI_AGENT_CONSTITUTION_PATH`
- `TIANSHI_CONWAY_ALLOWED_HOSTS`
- `CONWAY_API_KEY`
- `TAVILY_API_KEY`
- `CONTEXT7_API_KEY`
- `TIANSHI_TELEGRAM_BOT_TOKEN`
- `TIANSHI_TELEGRAM_CHAT_ID`
- `TIANSHI_TELEGRAM_THREAD_ID`
- `TIANSHI_X402_BUDGET_USD`
- `TIANSHI_X402_PER_REQUEST_USD`
- `TIANSHI_X402_PER_HOUR_USD`
- `TIANSHI_X402_ALLOWED_DOMAINS`
- `TIANSHI_DEXTER_ENABLED`
- `TIANSHI_DEXTER_PATH`
- `TIANSHI_DEXTER_PYTHON_BIN`
- `TIANSHI_DEXTER_DATABASE_URL`
- `TIANSHI_DEXTER_HTTP_URL`
- `TIANSHI_DEXTER_WS_URL`
- `TIANSHI_DEXTER_NETWORK`
- `TIANSHI_DEXTER_DEFAULT_MODE`
- `TIANSHI_DEXTER_ALLOW_LIVE`
- `TIANSHI_DEXTER_MAINNET_DRY_RUN`
- `TIANSHI_GODMODE_ENABLED`
- `TIANSHI_GODMODE_API_URL`
- `TIANSHI_GODMODE_API_KEY`
- `TIANSHI_GODMODE_OPENROUTER_KEY`
- `TIANSHI_GODMODE_DEFAULT_MODEL`
- `TIANSHI_POLYMARKET_ENABLED`
- `TIANSHI_POLYMARKET_GAMMA_URL`
- `TIANSHI_POLYMARKET_CLOB_URL`
- `TIANSHI_POLYMARKET_DEFAULT_MODE`
- `TIANSHI_POLYMARKET_ALLOW_LIVE`
- `TIANSHI_POLYMARKET_TOS_ACK`
