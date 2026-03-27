# Polymarket Agent Ability

Use this ability when Tianshi or an autonomous sub-agent needs prediction-market reference data, market inspection, or agent-side participation plumbing around Polymarket.

Rules:

- Keep this ability internal to Tianshi and autonomous agents. It is not a human trading feature.
- Route market-data access through `lib/server/polymarket-agent.ts`.
- Respect Polymarket terms and jurisdiction controls. Live execution stays gated behind explicit environment acknowledgement.
- Use the public Gamma feed for read-only market discovery unless a compliant live path is intentionally enabled.
- Public-facing surfaces may reference agent calls and market links, but order execution details stay internal.

