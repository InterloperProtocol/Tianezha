# Skill Hub

This repository uses a shared skill hub to decide which upstream repos become vendored adapters, optional sidecars, documentation references, or exclusions.

Canonical sources:

- `services/tianshi-automaton/vendor/skill-hub/registry.json`
- `services/tianshi-automaton/vendor/skill-hub/SKILL.md`
- `packages/adapters/src/skillhub.ts`

The runtime now surfaces a `tooling.skillHub` summary through `GET /api/agent/status`, so Tianshi and subagents can read the same registry state without inventing a second knowledge base.

## Classification Rules

- `vendorable_adapter`: a repo that can be wrapped as a local service, adapter, or vendored runtime asset.
- `optional_adapter`: a useful product or service that should stay separate and be consumed as a sidecar.
- `documentation_only_reference`: a repo or list that belongs in the knowledge base, not in the runtime.
- `out_of_scope`: a repo that is interesting but not a fit for this install plan.

## What The Hub Is For

- deciding which repos get installed under Tianshi
- keeping adapter boundaries visible
- preventing subagents from making hidden install decisions
- keeping the same registry visible to Claude, Codex, and the Tianshi runtime

## High-Priority Adapter Targets

The strongest install candidates are:

- `iflytek/skillhub`
- `Panniantong/Agent-Reach`
- `feuersteiner/contextrie`
- `calesthio/Crucix`
- `itsOwen/CyberScraper-2077`
- `Lum1104/Understand-Anything`
- `aldinokemal/go-whatsapp-web-multidevice`
- `pinchtab/pinchtab`
- `elder-plinius/G0DM0D3`
- `qeeqbox/social-analyzer`
- `GetStream/Vision-Agents`

## Optional Sidecars

These are useful, but they should remain separate services:

- `aden-hive/hive`
- `we-promise/sure`
- `firecrawl/open-lovable`
- `hkjarral/AVA-AI-Voice-Agent-for-Asterisk`
- `blinkospace/blinko`
- `C4illin/ConvertX`
- `hunvreus/devpush`
- `Yeachan-Heo/oh-my-claudecode`

## Knowledge-Base References

These are reference-only and stay out of the runtime:

- `mtdvio/every-programmer-should-know`
- `YouMind-OpenLab/awesome-nano-banana-pro-prompts`
- `hesamsheikh/awesome-openclaw-usecases`

## Exclusions

The current plan keeps these out of the install path:

- `fluxerapp/fluxer`
- `pear-devs/pear-desktop`
- `Raiper34/spooty`
- `felixrieseberg/windows95`

## Non-Repo Reference Signals

These are useful research signals, but they are not installable repos:

- `https://www.opensourceprojects.dev/post/1943942641428660617`
- `https://x.com/oliviscusAI/status/2036756935316226261?s=20`
- `https://x.com/akshay_pachaar/status/2035341800739877091?s=20`
- `https://x.com/ihtesham2005/status/2037484864090644653?s=20`
- `https://x.com/simplifyinAI/status/2037575542149357627?s=20`
- `https://x.com/heyrimsha/status/2037145631987556748?s=20`

## Operating Rule

Tianshi stays the selector of active skills. Subagents can read the registry and propose changes, but only the main brain decides what gets installed or exposed.
