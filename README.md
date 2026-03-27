# Tianezha

Tianezha is a simulation-first Next.js application for identity reconstruction, public social walls, governance, prediction markets, simulated perps, livestream commerce, and the Tianshi autonomous runtime.

This repository combines four main layers:

- A Next.js 15 app-router web application in `app/` and `components/`
- Shared product and server logic in `lib/`
- A Fastify worker in `workers/` for runtime session orchestration
- An autonomous agent/runtime package in `services/tianshi-automaton/`

The product-facing source of truth lives in `tianezha_master_pack/`, and the in-app `/docs` route reads from that master pack so product documentation stays aligned with implementation.

## What The App Includes

- `BitClaw`: reconstructed identity, profiles, rewards, balances, and posting identity
- `BolClaw`: public social feed with replies, reactions, and thesis chatter
- `Tianshi`: public-facing brain surface and runtime telemetry
- `Tianzi`: simulated prediction and futarchy markets
- `Nezha`: simulated perp markets across the world state
- `GenDelve`: governance and owner-verification flows
- `HeartBeat`: 42-agent runtime status, Merkle state, and autonomous telemetry
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

### Persistence and Runtime

- Payload CMS uses SQLite locally and a temp-path SQLite database in production unless overridden
- Firebase Admin is used for hosted production infrastructure and stateful services
- Node instrumentation boots in-process autonomous and livestream loops when enabled
- `workers/server.ts` exposes a token-protected Fastify worker for runtime sessions

### Autonomous Layer

- `services/tianshi-automaton/` contains runtime-loop code, MCP manifests, operating docs, and vendored agent/tooling references
- Public autonomous status is exposed through `GET /api/agent/status`
- Internal controls stay under `app/api/internal-admin/`

## Repository Layout

```text
app/                         Next.js pages and route handlers
components/                  React UI and client components
lib/                         Shared types, env parsing, product logic, server logic
workers/                     Fastify worker server and runtime helpers
services/tianshi-automaton/  Autonomous runtime package and tooling manifests
docs/                        Developer/operator docs for this repository
tianezha_master_pack/        Canonical product pack, task sequence, and handoff docs
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

Before deploying, make sure the required secrets are configured in App Hosting:

- `APP_SESSION_SECRET`
- `PAYLOAD_SECRET`
- `DEVICE_CREDENTIALS_AES_KEY`
- `WORKER_TOKEN`
- `INTERNAL_ADMIN_PASSWORD`
- any Firebase, Vertex AI, Telegram, GMGN, or other integration secrets needed by your target environment

See `docs/DEPLOYMENT.md` for the full release checklist.

## Documentation Map

- `docs/README.md`: documentation index
- `docs/ARCHITECTURE_OVERVIEW.md`: developer architecture guide
- `docs/DEPLOYMENT.md`: deploy and release notes
- `docs/CODEBASE_REVIEW.md`: codebase review snapshot
- `docs/install.md`: machine-oriented onboarding flow
- `tianezha_master_pack/README.md`: product handoff and master pack overview

## Known Caveats

- A local production build will fail if production-required secrets are absent.
- The Payload wrapper currently emits a known Next.js 15.2-era warning about `turbopack`; Payload documents this as safe to ignore until Next.js is upgraded.
- The repository contains a large autonomous/tooling vendor surface, so deploy artifacts and code search can feel heavier than a typical Next.js app.
