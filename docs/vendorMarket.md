# Vendor And Domain Market

`packages/core/src/vendorMarket.ts` owns vendor offers, domain offers, reservation intents, assignments, and completions.

## What It Covers

- domain search and reservation offers
- storage and preservation offers
- custom vendor services
- assignment and completion tracking

## Principles

- vendor coordination is native to the mesh
- payment rails remain adapters
- Conway can participate as an adapter, but it is never required
- domain vending must still work with Conway disabled

## Current Use

The runtime summary in `lib/server/mesh-commerce.ts` seeds example domain offers so the status API and UI can show a free-floating vendor layer beside compute pricing.
