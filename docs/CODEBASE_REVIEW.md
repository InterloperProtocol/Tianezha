# Tianezha Codebase Review

Review date: 2026-03-27

## Executive Summary

The repository is in better shape than the current top-level documentation suggested.

- Lint passes
- Typecheck passes
- All Vitest suites pass
- The application structure is coherent across app, shared logic, worker runtime, and autonomous package boundaries

The main release risk is not failing tests. It is deployment ergonomics and operator clarity:

- production builds require secrets that are not present in a bare checkout
- the env surface is large and easy to misconfigure
- the repo mixes product-pack docs, engineering docs, runtime docs, and vendored upstream references in one tree

## What Looks Strong

### Clear layering

The application has a real architecture, not just a pile of routes:

- Next.js UI and APIs in `app/`
- shared domain and server logic in `lib/`
- worker server in `workers/`
- autonomous runtime package in `services/tianshi-automaton/`

### Good test coverage in high-value areas

Automated coverage is especially solid around:

- API routes
- moderation and admin controls
- request security
- autonomous agent policy logic
- simulation and runtime helpers

### Defensive env handling

`lib/env.ts` centralizes most environment validation and defaulting. That is much safer than scattering `process.env` lookups throughout the codebase.

### Product docs tied to implementation

Using `tianezha_master_pack/` as the source for the in-app docs is a strong move. It reduces drift between product narrative and the `/docs` surface.

## Findings

### Medium: local production build is not turnkey

`npm run build` fails on a bare checkout if production-required secrets are not configured.

Observed failure:

- `PAYLOAD_SECRET or APP_SESSION_SECRET must be configured in production`

Impact:

- new contributors may assume the repo is broken when only env setup is incomplete
- release verification is harder than necessary without a documented minimal secret set

Recommendation:

- keep the security check
- document the required local build secrets clearly
- optionally add a checked-in `.env.local.example` or a dedicated build-verification script later

### Low: docs UI contains a small text-encoding defect

The docs landing page had a mojibake bullet separator in one string.

Impact:

- small polish issue

Status:

- fixed in this documentation pass

### Low: framework warning during build

Next.js emits an `Invalid next.config.ts options` warning related to `turbopack` when wrapped by Payload.

Impact:

- warning noise during builds
- not currently a blocker

Recommendation:

- track a Next.js/Payload upgrade when practical

## Release Readiness

### Green

- lint
- typecheck
- tests

### Yellow

- build/release verification without secrets
- onboarding clarity for the env surface
- operational complexity around autonomous and vendored tooling

## Recommended Next Steps

1. Keep the new README and deployment docs as the primary human onboarding path.
2. Add a sanitized `.env.local.example` specifically for local build verification.
3. Consider splitting operator/runtime docs further from product docs as the autonomous package grows.
4. Revisit framework upgrades to reduce build warning noise.
