# Tianezha

Tianezha is the simulation-first Next.js shell for reconstructed identity, open public profile walls, prediction markets, governance, simulated perps, and the 42-agent heartbeat.

The repo now treats `tianezha_master_pack/` as the naming and product source-of-truth, and `/docs` reads directly from that master pack so the implementation and the docs stay aligned.

The public deployment is hosted on Firebase App Hosting in Google Cloud, and the autonomous/runtime scaffold still targets Vertex AI Gemini via the Google Gen AI SDK.

## Surfaces

- `/`: Tianezha shell with address load, the 3x2 world map, world state, and the permanent loaded-profile rail
- `/bitclaw`: BitClaw profile layer, character sheets, rewards, and profile walls
- `/bolclaw`: BolClaw public social feed, replies, reactions, thesis notes, and world chatter
- `/tianzi`: Tianzi simulated prediction markets
- `/gendelve`: GenDelve governance and owner-verification actions
- `/nezha`: Nezha simulated perps on the two token worlds
- `/heartbeat`: HeartBeat live 42-agent world state and Merkle status
- `/tianshi`: Tianshi brain view with thesis, stance, signals, and advanced state
- `/docs`: master-pack-backed product and implementation docs
- `/eligibility`: legacy route
- `/xclaw`: legacy redirect to `/bitclaw`
- `/livestream`: legacy redirect into the Tianezha stack
- `/launchonomics`: legacy route
- `/bagstroke`: legacy route
- `/streamer`: legacy redirect to `/bolclaw`

## Master Pack

- `tianezha_master_pack/README.md`: handoff overview
- `tianezha_master_pack/docs/`: canonical product, architecture, identity, heartbeat, bots, and roadmap docs
- `tianezha_master_pack/tasks/00_master_sequence.md`: build sequence reference
- `tianezha_master_pack/notes/`: trusted-box and repo-shape notes
- `tianezha_master_pack/.codex/`: master prompt, subagent, and interface handoff notes
- `/docs`: in-app docs surface generated from the master pack docs, tasks, notes, and Codex handoff files

## Integrated References

- `Refs/openclaw`: OpenClaw reference repo
- `Refs/free-crypto-news`: free crypto news API reference
- `Refs/solana-launchpad-ui`: UI theme reference
- `Refs/AuditKit`: audit reference material
- `PUMPREF/pump-fun-skills`: local pump-fun skill reference repo
- `~/.codex/skills/tokenized-agents`: installed Pump tokenized-agent Codex skill
- `services/tianshi-automaton/vendor/anthropic-skills`: vendored official Anthropic skill pack for document, design, and workflow operations
- `services/tianshi-automaton/mcp/tianshi-codex.config.json`: consolidated Tianshi MCP manifest for Solana, Conway fallback, Tavily, Context7, Task Master, Excel, Helius Docs, and Playwright

## Packages

- `@pump-fun/pump-sdk`
- `@pump-fun/agent-payments-sdk`
- `@google/genai`

## Agent Model Scaffold

- subscription cNFTs are now sent manually after an eligibility check
- public chart jobs now generate a dedicated Solana payment address per request and sweep confirmed funds into the Tianshi revenue wallet
- the canonical constitutional layer now lives in `lib/constitution.ts`, `docs/CONSTITUTION.md`, and `docs/ECONOMIC_POLICY.md`
- constitutional defaults now target a `0.69420 SOL` reserve floor, `51%` creator-fee agent share (`40%` buyback+burn, `11%` trading wallet), `0.01 SOL` billboards, and `50/10/40` trading-profit allocation above reserve
- LaunchONomics determines whether a wallet qualifies for a subscription cNFT
- `/api/constitution` exposes the public constitution snapshot
- `/api/agent/status` exposes the HeartBeat runtime payload plus the public constitution snapshot, constitution hash, treasury posture, and revenue buckets
- `/api/agent/status` now also exposes configured MCP server names plus vendored and locally installed skill inventory for the sovereign runtime toolchain
- hosted model defaults to `gemini-2.5-flash` on Vertex AI

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Env Setup

Start from `.env.example`. The app is ready for later wiring of:

- Tianshi token mint and burn values
- cNFT collection, tree, and authority secrets
- Helius and Birdeye API keys
- agent payment currency and token mint addresses
- Vertex AI Gemini project, region, and model overrides

## Hosting

- Firebase project: `tianezha-app`
- App Hosting URL: `https://tianshi--tianezha-app.us-east4.hosted.app`
- App Hosting backend: `tianshi`
- Vertex AI access is granted to the App Hosting compute service account with `roles/aiplatform.user`

## Notes

- The news panel is wired against the `cryptocurrency.cv` API surfaced by the `free-crypto-news` reference.
- The UI theme is tuned toward the Solana Launchpad UI reference, while agent and audit work is documented in `docs/reference-stack.md`.
- The constitutional source-of-truth docs live in `docs/CONSTITUTION.md`, `docs/ECONOMIC_POLICY.md`, and `docs/IMPLEMENTATION_NOTES.md`.
