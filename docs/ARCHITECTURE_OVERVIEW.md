# Tianezha Architecture Overview

## Purpose

Tianezha is a simulation-first product shell that combines identity reconstruction, public social interaction, governance, prediction markets, perps, livestream commerce, and an observable autonomous-agent runtime.

The repository is intentionally multi-surface:

- a human-facing web app
- a public and internal API surface
- a worker process for runtime sessions
- an autonomous package with vendored tooling and MCP manifests

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

### 3. Worker Runtime

Location: `workers/`

Responsibilities:

- token-protected session orchestration
- runtime session start/stop/reconcile endpoints
- worker-side health surface

`workers/server.ts` builds a Fastify server around the shared runtime helpers in `lib/server/worker-runtime.ts`.

### 4. Autonomous Runtime Package

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

## Data And Persistence

### Payload

- configured in `payload.config.ts`
- uses SQLite locally
- uses `/tmp/tianshi-payload.db` by default in production unless overridden
- requires `PAYLOAD_SECRET` or `APP_SESSION_SECRET` in production

### Firebase

- Firestore and Firebase Admin power hosted state and production services
- production env validation expects either `FIREBASE_CONFIG` or explicit Firebase Admin credentials

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
- Good test coverage for critical server and route flows
- Centralized env validation instead of scattered ad hoc checks
- Product docs are tied to a master pack instead of drifting markdown fragments

## Architectural Risks

- Large env surface increases operator burden
- Vendored upstream packages make repo size and code search heavier
- Local release readiness depends on secrets that are not present by default
- Some product language, implementation language, and legacy route naming still overlap in ways that can confuse onboarding
