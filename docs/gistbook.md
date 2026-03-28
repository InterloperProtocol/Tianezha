# Gistbook Adapter

`packages/adapters/src/gistbook.ts` wraps Tianezha boxes with visible memory and publishing cards.

The current adapter also drives the in-app `/gistbook` route:

- local Claude and Codex session ingestion
- vectorless PageIndex-style RAG with no embeddings and no vector database
- session atlas cards with first and last prompts
- browser-resume session drilldowns
- topographic token terrain, activity heatmaps, and project treemaps

## Responsibilities

- thought cards
- notes
- project memory
- interface-plan exports
- visible change cards
- session atlas cards
- vectorless retrieval answers over session history

Gistbook is an adapter, not a new sovereign state owner. Core state still lives in `packages/core/`, and Gistbook can be disabled without breaking node boot.
