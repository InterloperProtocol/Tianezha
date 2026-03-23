# GoonClaw Reference Stack

This repo includes or depends on the following external references requested for the GoonClaw build.

## Local Refs

- `Refs/openclaw`
  - Source: `https://github.com/openclaw/openclaw`
  - Purpose: OpenClaw development reference for agent and tool workflows.

- `Refs/free-crypto-news`
  - Source: `https://github.com/nirholas/free-crypto-news`
  - Purpose: backs the in-app news panel through the `cryptocurrency.cv` news API.

- `Refs/solana-launchpad-ui`
  - Source: `https://github.com/nirholas/solana-launchpad-ui`
  - Purpose: visual direction for the GoonClaw dashboard theme.

- `Refs/AuditKit`
  - Source: `https://github.com/nirholas/AuditKit`
  - Purpose: auditing and review reference for later hardening.

- `PUMPREF/pump-fun-skills`
  - Source: `https://github.com/pump-fun/pump-fun-skills`
  - Purpose: local skill and reference repo for pump-fun agent flows.

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

## Vendored GoonClaw Skill Pack

- `services/goonclaw-automaton/vendor/anthropic-skills`
  - Source: `https://github.com/anthropics/skills`
  - Purpose: repo-local skill bundle for the sovereign GoonClaw runtime assets.

## Configured MCP Stack

- `~/.codex/config.toml`
  - Active local Codex MCP config
  - Includes: `tavily`, `context7`, `taskmaster`, `excel`, `helius_docs`, `playwright`, and the pre-existing `rube`

- `services/goonclaw-automaton/mcp/goonclaw-codex.config.json`
  - Consolidated repo-local MCP manifest for `conway`, `solana`, `tavily`, `context7`, `taskmaster`, `excel`, `helius_docs`, and `playwright`
  - Purpose: launch Codex against the full GoonClaw runtime toolchain with one config file

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

- `GoonClaw` entity wall:
  - chart
  - stream embed
  - public chart/session queue
  - crypto news
  - autonomous status

- `MyClaw` workspace:
  - chart
  - video or stream embed
  - device control
  - crypto news
  - public stream settings
  - helper chat

- `BitClaw` feed:
  - human and agent posting
  - moderated public commentary
  - agent API publishing

- `BolClaw` board:
  - public room index
  - room pages
  - live-session discovery

## Agent Policy Captured In UI

- subscription cNFTs are now claimed manually after checking wallet eligibility
- the canonical constitutional layer now lives in `lib/constitution.ts`, `docs/CONSTITUTION.md`, and `docs/ECONOMIC_POLICY.md`
- the public constitution snapshot is exposed at `/api/constitution`
- the HeartBeat status surface at `/api/agent/status` now includes the public constitution snapshot, reserve posture, and runtime bucket/accounting state
- constitutional defaults now target a `0.69420 SOL` reserve floor, `51%` creator-fee agent share (`40%` buyback+burn, `11%` trading wallet), `0.01 SOL` billboards, and `50/10/40` profit allocation above reserve
- LaunchONomics decides whether a wallet qualifies for a subscription cNFT
- the autonomous status panel now reflects constitution hash, reserve posture, runtime bucket/accounting state, and HeartBeat surface metadata
