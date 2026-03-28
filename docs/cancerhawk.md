# CancerHawk Adapter

`packages/adapters/src/cancerhawk.ts` is a Python-first cancer research adapter.

## Guardrails

- disabled by default
- research-only
- non-diagnostic
- non-treatment
- optional and removable without affecting core boot

## Intended Work

- TCGA-style exploration
- target discovery support
- bounded research job execution through the mesh

CancerHawk is intentionally separate from the compute-market core so regulated or domain-specific research work does not leak into baseline node behavior.
