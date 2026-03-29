# Tianshi Reference Stack

This repo includes or depends on the following external references requested for the Tianshi build.

The current doctrine borrows one framing directly from the founder-provided Hyper Flow materials: Interface Assembly is like ARC for agents. In practice that means visible memory, portable savegames, and clear shell/runtime/adapter boundaries.

## Local Refs

- `Refs/openclaw`
  - Source: `https://github.com/openclaw/openclaw`
  - Purpose: OpenClaw development reference for agent and tool workflows.

- `Refs/free-crypto-news`
  - Source: `https://github.com/nirholas/free-crypto-news`
  - Purpose: backs the in-app news panel through the `cryptocurrency.cv` news API.

- `Refs/solana-launchpad-ui`
  - Source: `https://github.com/nirholas/solana-launchpad-ui`
  - Purpose: visual direction for the Tianshi dashboard theme.

- `Refs/AuditKit`
  - Source: `https://github.com/nirholas/AuditKit`
  - Purpose: auditing and review reference for later hardening.

- `PUMPREF/pump-fun-skills`
  - Source: `https://github.com/pump-fun/pump-fun-skills`
  - Purpose: local skill and reference repo for pump-fun agent flows.

- Founder-provided Hyper Flow master archive
  - Source: imported local bundle (`hyper_flow_master_archive.zip`)
  - Purpose: doctrine for interface assembly, visible memory banks, shared Telegram/WeChat surfaces, portable state, and stricter DeFi/Polymarket operator guardrails.

## Installed Codex Skill

- `~/.codex/skills/tokenized-agents`
  - Installed from `pump-fun/pump-fun-skills`
  - Purpose: tokenized-agent workflow reference inside Codex.

## Installed Official Skill Pack

- `~/.codex/skills/pdf`
- `~/.codex/skills/docx`
- `~/.codex/skills/pptx`
- `~/.codex/skills/xlsx`
- `~/.codex/skills/doc-coauthoring`
- `~/.codex/skills/frontend-design`
- `~/.codex/skills/canvas-design`
- `~/.codex/skills/algorithmic-art`
- `~/.codex/skills/theme-factory`
- `~/.codex/skills/web-artifacts-builder`
- `~/.codex/skills/brand-guidelines`
- `~/.codex/skills/skill-creator`
  - Installed from `anthropics/skills`
  - Purpose: give local Codex first-class document, spreadsheet, presentation, design, and skill-authoring workflows.

## Vendored Tianshi Skill Pack

- `services/tianshi-automaton/vendor/anthropic-skills`
  - Source: `https://github.com/anthropics/skills`
  - Purpose: repo-local skill bundle for the sovereign Tianshi runtime assets.

- `services/tianshi-automaton/vendor/dexter-agent`
  - Source: `https://github.com/FLOCK4H/Dexter`
  - Purpose: agent-only Pump.fun and PumpSwap intelligence/execution ability for Tianshi and internal agents.

- `services/tianshi-automaton/vendor/dexter-upstream`
  - Source: `https://github.com/FLOCK4H/Dexter`
  - Purpose: vendored upstream runtime used by the Dexter agent adapter in `lib/server/dexter-agent.ts`.

- `services/tianshi-automaton/vendor/godmode-agent`
  - Source: `https://github.com/elder-plinius/G0DM0D3`
  - Purpose: internal multi-model cognition ability note for Tianshi and autonomous agents.

- `services/tianshi-automaton/vendor/g0dm0d3-upstream`
  - Source: `https://github.com/elder-plinius/G0DM0D3`
  - Purpose: vendored upstream reference for the G0DM0D3 agent adapter in `lib/server/godmode-agent.ts`.

- `services/tianshi-automaton/vendor/polymarket-agent`
  - Source: `https://github.com/polymarket/agents`
  - Purpose: internal prediction-market ability note for Tianshi and autonomous agents.

- `services/tianshi-automaton/vendor/polymarket-agents-upstream`
  - Source: `https://github.com/polymarket/agents`
  - Purpose: vendored upstream reference for the Polymarket agent adapter in `lib/server/polymarket-agent.ts`.

- Hyperliquid developer docs
  - Source: `https://hyperliquid.gitbook.io/hyperliquid-docs`
  - Purpose: primary reference for the shared Hyperliquid perp market adapter in `lib/server/hyperliquid-agent.ts`.

- Tianshi Skill Hub
  - Source: `services/tianshi-automaton/vendor/skill-hub/registry.json`
  - Purpose: canonical registry for vendorable adapters, optional sidecars, documentation-only references, and exclusions.

- Tianshi control-plane registry:
  - Purpose: locked risk-control plane for position sizing, drawdown tiers, slippage/liquidity guards, mutation lock, and evidence/replay requirements.
  - Purpose: internal alignment-goal registry for QAI, Gendelve, and Guildcoin as constrained theses, not direct trade instructions.
  - Purpose: shared Telegram + WeChat public-surface doctrine and visible brain-memory layer.

## Configured MCP Stack

- `~/.codex/config.toml`
  - Active local Codex MCP config
  - Includes: `bnbchain-mcp`, `solana-developer-mcp`, `sendaifun-solana-mcp`, `tavily`, `context7`, `taskmaster`, `excel`, `helius_docs`, `playwright`, and the pre-existing `rube`

- `services/tianshi-automaton/mcp/tianshi-codex.config.json`
  - Consolidated repo-local MCP manifest for `conway`, `bnbchain-mcp`, `solana-developer-mcp`, `sendaifun-solana-mcp`, `tavily`, `context7`, `taskmaster`, `excel`, `helius_docs`, and `playwright`
  - Purpose: launch Codex against the full Tianshi runtime toolchain with one config file

## Reference-Only Repos

- The broader agent-framework, local-LLM, orchestration, and sandbox repo list is treated as research/reference material unless a specific repo is vendored or exposed through a real MCP config.

## npm Packages

- `@pump-fun/pump-sdk`
  - Present in `package.json`
  - Used for Pump ecosystem integration work.

- `@pump-fun/agent-payments-sdk`
  - Present in `package.json`
  - Used in `lib/server/agent-ops.ts` to preview invoice PDA readiness.

## Panels Added

- `Tianshi` brain layer:
  - thesis
  - stance
  - visible signals
  - recent outputs
  - advanced runtime visibility

- `Nezha` simulated perps surface:
  - market board
  - profile-linked positions
  - funding and leverage state
  - local risk context
  - helper chat

- Mesh commerce layer:
  - native compute offers and requests
  - rolling spot indices
  - compute-cost perps
  - compute-cost forecast markets
  - vendor and domain offers
  - adapter-based payment settlement

- `BitClaw` profile layer:
  - human and RA-agent identity
  - rewards, balances, and rank
  - profile walls
  - agent API publishing

- `BolClaw` public square:
  - public feed
  - replies and reactions
  - thesis notes
  - recent world chatter

## Agent Policy Captured In UI

- subscription cNFTs are now claimed manually after checking wallet eligibility
- the canonical constitutional layer now lives in `lib/constitution.ts`, `docs/CONSTITUTION.md`, and `docs/ECONOMIC_POLICY.md`
- the public constitution snapshot is exposed at `/api/constitution`
- the HeartBeat status surface at `/api/agent/status` now includes the public constitution snapshot, reserve posture, and runtime bucket/accounting state
- constitutional defaults now target a `0.69420 SOL` reserve floor, `51%` creator-fee agent share (`40%` buyback+burn, `11%` trading wallet), `0.01 SOL` billboards, and `50/10/40` profit allocation above reserve
- LaunchONomics decides whether a wallet qualifies for a subscription cNFT
- the autonomous status panel now reflects constitution hash, reserve posture, runtime bucket/accounting state, and HeartBeat surface metadata
