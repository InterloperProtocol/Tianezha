# Tianshi Skill Hub

This folder is the repo-local skill registry for Tianshi.

Use it as the shared adapter catalog for Tianshi, the main brain, and any subagent that needs to decide whether a repo should be vendored, kept as a sidecar, retained as a reference, or excluded.

Canonical files:

- `SKILL.md`: agent instructions for using the hub
- `registry.json`: machine-readable repo registry
- `README.md`: human overview

The registry intentionally separates:

- vendorable adapters
- optional adapters / sidecars
- documentation-only references
- out-of-scope repos

The public knowledge-base companion lives at [`docs/skill-hub.md`](/c:/SessionMint/Tianezha/docs/skill-hub.md).
