# Claude Overlay

Use this repository as a HyperFlow / Interface Assembly system.

Read first:

- `README.md`
- `docs/skill-hub.md`
- `docs/reference-stack.md`
- `services/tianshi-automaton/vendor/skill-hub/registry.json`
- `services/tianshi-automaton/README.md`

Rules:

- Tianshi is the sovereign writer for shared state.
- Subagents may inspect and propose, but they do not mutate canonical runtime state on their own.
- Treat adapters, references, and sidecars as separate boxes with clean boundaries.
- Use the skill hub before installing or wiring a new upstream repo.
