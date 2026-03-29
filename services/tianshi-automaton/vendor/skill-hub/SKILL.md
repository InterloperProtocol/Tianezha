# Tianshi Skill Hub

Use this skill when you need to classify a repo, choose an install target, or explain which external upstreams are adapters versus references.

Read the canonical registry first:

- `services/tianshi-automaton/vendor/skill-hub/registry.json`

Use the hub to keep the main brain in control of install decisions:

- vendorable adapters become local services, wrappers, or vendor folders
- optional adapters stay as sidecars and do not become sovereign state
- documentation-only references stay in the knowledge base
- out-of-scope repos are recorded but not installed

Treat the hub as shared infrastructure for Tianshi and all subagents, but never as a place where a subagent mutates canonical state on its own.
