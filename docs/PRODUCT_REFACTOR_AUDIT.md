# Product Refactor Audit

Date: 2026-03-27

This audit uses `README.md`, `/docs`, and `tianezha_master_pack/` as the product source of truth for the current refactor pass.

## Locked public names

- Tianezha = main product, website, chatbot shell
- Tianshi = brain
- Tianzi = prediction + futarchy markets
- Nezha = simulated perps
- BitClaw = profile layer
- BolClaw = public social feed
- GenDelve = governance
- QE-1205Q = admin-only internal flagship identity
- No livestreaming layer anywhere in the public product model

## Naming audit

Current mismatches still present in the repo:

- `README.md`
  - BitClaw was described as a public feed instead of the profile layer.
  - BolClaw was described as world discovery instead of the public social square.
  - Tianshi was still described as diagnostics.
- `docs/reference-stack.md`
  - Panel descriptions still referenced stream embeds, queues, and live-session discovery.
- `docs/CONSTITUTION.md`
  - Nezha was described as the UI layer.
  - BitClaw was described as the publishing/feed surface.
  - BolClaw was described as a livestream/gallery surface.
- `docs/ECONOMIC_POLICY.md`
  - The social-capital section still treated BolClaw as a livestream/gallery surface.
- `docs/llms-full.txt`
  - The public machine-readable overview still described the old Tianshi/Nezha/BitClaw/BolClaw model.
- `app/tianshi/page.tsx`
  - Public heading and hero copy still frame Tianshi as read-only diagnostics.
- `app/heartbeat/page.tsx`
  - Public heading still reads like runtime-state tooling rather than a living-world status surface.
- `lib/server/bitclaw.ts` and `lib/server/bitclaw-social.ts`
  - Legacy constant names from the pre-Tianezha rename were still present in backend code.
- Livestream routes and components still exist under `app/api/livestream/*`, `components/Livestream*`, `lib/server/livestream*`, and related surfaces.

## Pages that are too diagnostic

- Homepage, before this pass
  - Too much system framing and not enough product entry hierarchy.
- `app/tianshi/page.tsx`
  - Still an admin-facing runtime summary presented as a public destination.
- `app/heartbeat/page.tsx`
  - Still leans on runtime-state language instead of “42 active agents keep the world alive.”
- Parts of `/docs`
  - Reference material still mixes internal runtime and old public-brand descriptions.

## Where BitClaw was not treated as the center

- Homepage, before this pass
  - Address entry existed, but BitClaw was not clearly the identity center.
- `app/bitclaw/page.tsx`, before this pass
  - Framed too much like a feed surface rather than the profile layer.
- `components/identity/LoadedIdentityRail.tsx`, before this pass
  - Loaded profile state existed but did not summarize enough cross-module identity context.
- `app/bolclaw/page.tsx`, before this pass
  - Public feed context was not anchored strongly enough back to BitClaw.

## Homepage keep / move / simplify / delete

Keep:

- Address entry
- Right-side loaded profile rail
- HeartBeat visibility
- The two live `$CAMIUP` worlds
- World-level chat shell

Move or demote:

- Detailed diagnostics
- Low-level runtime posture
- Builder/admin wording

Simplify:

- Hero into one primary action: enter address, rebuild profile, enter world
- Public explanation into a 3x2 module grid
- Support cards into BitClaw, HeartBeat, Tianzi, and Nezha summaries

Delete from the homepage:

- Debug-console framing
- “Runtime state” language
- Any implication that livestreaming is a public product box

## Refactor plan by page

### Homepage

- Done in this pass:
  - Replaced the old hero with a single entry action centered on address loading.
  - Added the required 3x2 grid:
    - BitClaw
    - BolClaw
    - Tianshi
    - Tianzi
    - Nezha
    - GenDelve
  - Kept HeartBeat out of the grid and moved it into supporting world-state cards.
  - Promoted the loaded-profile path so BitClaw becomes the natural next destination.

### BitClaw

- Done in this pass:
  - Reframed BitClaw as the profile layer and character sheet.
  - Added a stronger loaded-profile path with direct profile open and BolClaw posting flow.
  - Updated public copy so rewards, rank, balances, and profile continuity read as the center.

### BolClaw

- Done in this pass:
  - Reframed BolClaw as the public square.
  - Strengthened the link back to BitClaw profiles.
  - Shifted focus toward feed, chatter, replies, reactions, and world conversation.

### Tianshi

- Next:
  - Replace diagnostics-first hero copy with thesis, stance, signals, and world reading.
  - Hide raw runtime internals behind collapsible advanced panels or explicit admin framing.

### Tianzi

- Next:
  - Make the hybrid futarchy outcome more legible.
  - Tie profile identity and world allegiance more clearly to positions and outcomes.

### Nezha

- Next:
  - Make the simulated perps view feel attached to profile status, rewards, and social standing.
  - Reduce tool-like framing.

### GenDelve

- Next:
  - Emphasize that GenDelve is the only module requiring the 1-token verification transfer.
  - Tighten trust language around real governance.

### HeartBeat

- Next:
  - Keep the exact 42-agent rules visible.
  - Reframe copy from runtime-state language into living-world language.

## First-pass implementation status

Done:

- Naming audit
- Homepage 3x2 refactor
- BitClaw-first identity flow
- BitClaw-to-BolClaw posting flow
- Public docs alignment for the core product names

Still open after this pass:

- Tianshi brain refactor
- Tianzi consequence pass
- Nezha consequence pass
- GenDelve trust pass
- HeartBeat polish
- Full removal or containment of legacy livestream code and copy
