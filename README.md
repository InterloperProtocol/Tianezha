# Tianezha

Tianezha is a simulation-first HyperFlow shell with a Tianezha Node runtime and adapter-driven extensions for identity reconstruction, public social walls, governance, prediction markets, simulated perps, mesh commerce, and the Tianshi autonomous runtime.

Tianezha nodes natively buy and sell compute, services, storage, and preservation across the mesh. Payment rails are adapters. Conway is optional.

Interface Assembly is like ARC for agents: the shell stays legible, the runtime stays portable, and state can move as savegames instead of being trapped inside one deployment.

This repository combines six main layers:

- A Next.js 15 app-router web application in `app/` and `components/`
- Canonical mesh-commerce state owners in `packages/core/`
- Adapter modules in `packages/adapters/`
- Shared product and server logic in `lib/`
- A Fastify worker in `workers/` for runtime session orchestration
- An autonomous agent/runtime package in `services/tianshi-automaton/`
- A shared skill hub in `services/tianshi-automaton/vendor/skill-hub/`
- Project overlays in `.claude/` and `.codex/` for agent entrypoints and operating rules

The product-facing source of truth lives in `tianezha_master_pack/`, and the in-app `/docs` route reads from that master pack so product documentation stays aligned with implementation.

## What The App Includes

- `BitClaw`: reconstructed identity, profiles, rewards, balances, and posting identity
- `BolClaw`: public social feed with replies, reactions, and thesis chatter
- `Tianshi`: public-facing brain surface, sovereign writer, and runtime telemetry
- `Tianzi`: simulated prediction and futarchy markets plus compute-cost forecast bands
- `Nezha`: simulated perp markets plus compute-cost perp books
- `GenDelve`: governance and owner-verification flows
- `Heartbeat`: 42-agent runtime status, Merkle state, and autonomous telemetry
- `Mesh Commerce`: native compute, storage, preservation, and vendor/domain price discovery
- `Docs`: master-pack-backed documentation and machine-readable onboarding

## Architecture Snapshot

### Frontend and API

- Next.js 15 app router powers both pages and API routes
- React 19 components live in `components/`
- Route handlers under `app/api/` expose product, identity, social, moderation, and autonomous-runtime surfaces

### Shared Logic

- `lib/env.ts` centralizes environment parsing and production safeguards
- `lib/constitution.ts` defines the public constitutional and economic policy layer
- `lib/server/` contains the main application services for identity, posting, livestream, autonomous state, charts, moderation, and integrations
- `lib/master-pack-docs.ts` parses the master pack into the `/docs` UI

### Canonical Mesh Package Layer

- `packages/core/src/community.ts`: community bootstrap, reward policy, and no-wallet-connect defaults
- `packages/core/src/peer.ts`: peer registry, relay fallback, capability ads, and evidence digests
- `packages/core/src/subagents.ts`: Tianshi and RA market actors with human-terminal principal chains
- `packages/core/src/rewards.ts`: offchain reward ledger and `proof_of_compute`
- `packages/core/src/computeMarket.ts`: native spot compute market
- `packages/core/src/computePriceMarkets.ts`: compute indices, perps, forecasts, and reference-price engine
- `packages/core/src/vendorMarket.ts`: vendor and domain-market flows
- `packages/core/src/savegame.ts`: portable state export/import
- `packages/adapters/src/`: payment, Gistbook, and optional CancerHawk adapters
- `docs/skill-hub.md`: shared adapter/reference registry and install decision log

### Persistence and Runtime

- Payload CMS uses SQLite locally and a temp-path SQLite database in production unless overridden
- Firebase Admin is used for hosted production infrastructure and stateful services
- Mesh-commerce state is portable through savegame bundles and persisted locally under `.data/`
- Node instrumentation boots in-process autonomous and livestream loops when enabled
- `workers/server.ts` exposes a token-protected Fastify worker for runtime sessions

### Autonomous Layer

- `services/tianshi-automaton/` contains runtime-loop code, MCP manifests, operating docs, and vendored agent/tooling references
- Public autonomous status is exposed through `GET /api/agent/status`
- Internal controls stay under `app/api/internal-admin/`
- Tianshi remains the single writer for sovereign state even when RA agents request, sell, or hedge compute

## Repository Layout

```text
app/                         Next.js pages and route handlers
components/                  React UI and client components
packages/core/               Canonical mesh-commerce state owners
packages/adapters/           Payment and domain-specific adapters
lib/                         Shared types, env parsing, product logic, server logic
workers/                     Fastify worker server and runtime helpers
services/tianshi-automaton/  Autonomous runtime package and tooling manifests
.claude/                     Claude overlay instructions and repo-specific operating rules
.codex/                      Codex overlay instructions and repo-specific operating rules
docs/                        Developer/operator docs for this repository
tianezha_master_pack/        Canonical product pack, task sequence, and handoff docs
examples/                    Portable mesh-commerce savegame examples
public/                      Static assets and machine-readable docs
```

## Prerequisites

- Node.js 20+
- npm 10+
- Firebase CLI for hosted deployment
- Access to the Firebase App Hosting project and required secrets for production deploys

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create local env values from `.env.example`.

For development, a minimal `.env.local` should include at least:

```bash
APP_SESSION_SECRET=replace-with-at-least-16-chars
DEVICE_CREDENTIALS_AES_KEY=replace-with-at-least-16-chars
PAYLOAD_SECRET=replace-with-at-least-16-chars
TIANEZHA_ALLOWED_MUTATION_ORIGINS=http://localhost:3000
INTERNAL_ADMIN_LOGIN=admin
INTERNAL_ADMIN_PASSWORD=
WORKER_TOKEN=replace-with-at-least-16-chars
```

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Useful Scripts

- `npm run dev`: start the Next.js app
- `npm run build`: production build
- `npm run start`: serve the production build
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks
- `npm test`: run Vitest
- `npm run worker:dev`: start the Fastify worker
- `npm run tianshi:autonomous`: start the standalone autonomous runtime loop
- `npm run tianshi:dexter:bootstrap`: bootstrap Dexter integration

## Verification Status

At the time of this documentation refresh:

- `npm run lint`: passes
- `npm run typecheck`: passes
- `npm test`: passes
- `npm run build`: requires production-safe secrets such as `APP_SESSION_SECRET`, `PAYLOAD_SECRET`, and related runtime env values

That build behavior is intentional from a security standpoint, but it means a bare checkout without secrets will not complete a production build.

## Environment Notes

The env surface is large because the repo supports:

- local simulation and identity flows
- Payload-backed admin and moderation tools
- Firebase-hosted deployment
- livestream orchestration
- multiple agent integrations including Dexter, GMGN, Hyperliquid, Polymarket, Godmode, and AGFund

Use `.env.example` as the complete reference and `lib/env.ts` as the enforcement source of truth.

## Deployment

This repo is configured for Firebase App Hosting.

- Firebase config: `firebase.json`
- App Hosting runtime config: `apphosting.yaml`
- Firestore config: `firestore.rules`, `firestore.indexes.json`
- Intended public domain: `larpa.fun`

Before deploying, make sure the required secrets are configured in App Hosting:

- `APP_SESSION_SECRET`
- `PAYLOAD_SECRET`
- `DEVICE_CREDENTIALS_AES_KEY`
- `WORKER_TOKEN`
- `INTERNAL_ADMIN_PASSWORD`
- `TIANEZHA_ALLOWED_MUTATION_ORIGINS` if your public App Hosting origin differs from the runtime request URL seen by Next.js
- any Firebase, Vertex AI, Telegram, GMGN, or other integration secrets needed by your target environment

For the `larpa.fun` deployment, the allowed origins should include both:

- `https://larpa.fun`
- `https://www.larpa.fun`

See `docs/DEPLOYMENT.md` for the full release checklist.

## Documentation Map

- `docs/README.md`: documentation index
- `docs/ARCHITECTURE_OVERVIEW.md`: developer architecture guide
- `docs/computeMarket.md`: native compute-market doctrine and matching rules
- `docs/vendorMarket.md`: vendor/domain market doctrine
- `docs/payments.md`: payment adapter behavior and settlement modes
- `docs/gistbook.md`: Gistbook adapter scope
- `docs/skill-hub.md`: shared adapter registry and install policy
- `docs/cancerhawk.md`: CancerHawk adapter scope
- `docs/cancerMarkets.md`: simulated cancer-market scope
- `docs/rewards.md`: reward lanes and proof-of-compute policy
- `docs/DEPLOYMENT.md`: deploy and release notes
- `docs/CODEBASE_REVIEW.md`: codebase review snapshot
- `docs/install.md`: machine-oriented onboarding flow
- `tianezha_master_pack/README.md`: product handoff and master pack overview

## Known Caveats

- A local production build will fail if production-required secrets are absent.
- The Payload wrapper currently emits a known Next.js 15.2-era warning about `turbopack`; Payload documents this as safe to ignore until Next.js is upgraded.
- The repository contains a large autonomous/tooling vendor surface, so deploy artifacts and code search can feel heavier than a typical Next.js app.
