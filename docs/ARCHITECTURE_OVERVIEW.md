# Tianezha Architecture Overview

## Purpose

Tianezha is a simulation-first product shell that combines identity reconstruction, public social interaction, governance, prediction markets, perps, mesh commerce, and an observable autonomous-agent runtime.

Tianezha nodes natively buy and sell compute, services, storage, and preservation across the mesh. Payment rails are adapters. Conway is optional.

Interface Assembly is like ARC for agents: HyperFlow stays the shell, Tianezha Node stays the runtime, adapters stay modular, and portable savegames keep state movable across environments.

The repository is intentionally multi-surface:

- a human-facing web app
- a public and internal API surface
- a worker process for runtime sessions
- an autonomous package with vendored tooling and MCP manifests
- a canonical package layer for community, peer, reward, compute, and vendor state

## Main Application Layers

### 1. Next.js App

Location: `app/`, `components/`

Responsibilities:

- server-rendered and client-rendered UI
- app-router pages for each product surface
- route handlers for public and operator APIs
- in-app docs rendering

Important route groups:

- `app/page.tsx`: Tianezha shell entry point
- `app/bitclaw`, `app/bolclaw`, `app/tianshi`, `app/tianzi`, `app/nezha`, `app/gendelve`, `app/heartbeat`
- `app/docs`: master-pack-backed documentation UI
- `app/api`: public, agent, moderation, and admin APIs

### 2. Shared Domain Logic

Location: `lib/`

Responsibilities:

- env parsing and validation
- constitutional and economic policy
- shared types
- market, social, identity, moderation, and runtime logic
- server integrations and public-state shaping

Key files:

- `lib/env.ts`: centralized env resolution and production safeguards
- `lib/constitution.ts`: public economic and governance rules
- `lib/master-pack-docs.ts`: converts master pack markdown into doc blocks for the app
- `lib/server/*`: core application services

### 3. Canonical Mesh Package Layer

Location: `packages/core/`, `packages/adapters/`

Responsibilities:

- define protocol objects for market actors, principal chains, peers, offers, requests, rewards, settlements, perps, forecasts, and savegames
- keep community, peer, reward, savegame, subagent, compute-market, compute-price, and vendor-market state canonical
- make payment rails adapter-based instead of hard-wired into the runtime
- keep optional domain adapters such as Gistbook and CancerHawk isolated from core boot

Canonical owners:

- `packages/core/src/community.ts`
- `packages/core/src/peer.ts`
- `packages/core/src/rewards.ts`
- `packages/core/src/savegame.ts`
- `packages/core/src/subagents.ts`
- `packages/core/src/computeMarket.ts`
- `packages/core/src/computePriceMarkets.ts`
- `packages/core/src/vendorMarket.ts`
- `packages/core/src/protocol.ts`

### 4. Worker Runtime

Location: `workers/`

Responsibilities:

- token-protected session orchestration
- runtime session start/stop/reconcile endpoints
- worker-side health surface

`workers/server.ts` builds a Fastify server around the shared runtime helpers in `lib/server/worker-runtime.ts`.

### 5. Autonomous Runtime Package

Location: `services/tianshi-automaton/`

Responsibilities:

- standalone runtime loop bootstrapping
- external-agent tooling references
- MCP config manifests
- vendored skills and upstream integration packages

This directory is closer to an operator/runtime package than a normal frontend folder. It materially affects public status and internal controls.

## Runtime Model

There are two ways runtime loops can start:

- in-process, through `instrumentation.node.ts`
- out-of-process, through the worker or autonomous runtime scripts

This is controlled primarily by env configuration such as:

- `ALLOW_IN_PROCESS_WORKER`
- `WORKER_URL`
- `WORKER_TOKEN`
- `TIANSHI_AUTONOMOUS_ENABLED`

Tianshi remains the single writer for sovereign state. RA agents can request, sell, and hedge compute, but they do so through principal chains that terminate in a human principal and never bypass parent-brain authority.

## Data And Persistence

### Payload

- configured in `payload.config.ts`
- uses SQLite locally
- uses `/tmp/tianshi-payload.db` by default in production unless overridden
- requires `PAYLOAD_SECRET` or `APP_SESSION_SECRET` in production

### Firebase

- Firestore and Firebase Admin power hosted state and production services
- production env validation expects either `FIREBASE_CONFIG` or explicit Firebase Admin credentials

### Mesh Savegames

- `packages/core/src/savegame.ts` exports and restores canonical mesh state
- `.data/mesh-commerce-state.json` stores the local mesh-commerce bundle used by runtime summaries and tests
- examples in `examples/` show portable savegame shapes for cancer research communities and compute-vendor nodes

## Documentation Model

The repository uses two doc systems:

- `docs/` for engineering and operations
- `tianezha_master_pack/` for product truth

The in-app `/docs` route reads from `tianezha_master_pack/` via `lib/master-pack-docs.ts`.

## Testing And Quality

Current automated checks:

- ESLint via `npm run lint`
- TypeScript via `npm run typecheck`
- Vitest via `npm test`

Coverage is strongest in:

- API route handlers
- autonomous policy logic
- moderation and request security
- simulation and runtime helpers

The main gap is release ergonomics: a clean checkout without production-like env values does not build in production mode.

## Architectural Strengths

- Strong separation between UI, shared logic, worker runtime, and autonomous package
- Clear package ownership for mesh-commerce state
- Deterministic compute matching and reference-price composition
- Good test coverage for critical server and route flows
- Centralized env validation instead of scattered ad hoc checks
- Product docs are tied to a master pack instead of drifting markdown fragments

## Architectural Risks

- Large env surface increases operator burden
- Vendored upstream packages make repo size and code search heavier
- Local release readiness depends on secrets that are not present by default
- Some product language, implementation language, and legacy route naming still overlap in ways that can confuse onboarding
- Portable state helps, but docs and runtime must be kept aligned whenever new adapters or markets are introduced
