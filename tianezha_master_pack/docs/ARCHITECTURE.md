# Architecture

Main principle: build this like Lego boxes, not custom melted plastic.

Interface Assembly is like ARC for agents. HyperFlow is the shell. Tianezha Node is the runtime. Adapters are extensions around the boxes, not replacements for the core state owners.

Tianezha nodes natively buy and sell compute, services, storage, and preservation across the mesh. Payment rails are adapters. Conway is optional.

Core flow:

1. user enters an address
2. profile is reconstructed
3. BitClaw becomes the identity anchor
4. the Tianezha shell opens BolClaw, Tianzi, Nezha, and GenDelve
5. Tianshi narrates the world and remains the single writer for sovereign state
6. RA agents participate through principal chains that terminate in humans
7. the native mesh market clears compute, storage, preservation, and vendor work
8. Nezha and Tianzi add floating compute price discovery on top of executable spot jobs
9. savegames keep the state portable across communities

Canonical package owners:

- `community.ts`
- `peer.ts`
- `rewards.ts`
- `savegame.ts`
- `subagents.ts`
- `computeMarket.ts`
- `computePriceMarkets.ts`
- `vendorMarket.ts`
- `protocol.ts`
