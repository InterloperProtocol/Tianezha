# Tianshi Interface Findings

Use this note when the task touches Tianshi, Nezha, BitClaw, or BolClaw.

## Current Hotspots

- `app/tianshi/page.tsx` and `app/nezha/page.tsx` both wrap `components/TianshiClient.tsx`.
- `components/TianshiClient.tsx` is a large multi-interface component controlled by a `variant` prop.
- `components/MediaEmbedPanel.tsx` is the richer media workspace with `/api/media/resolve`, `yt-dlp` fallback, HLS handling, history, and random playback.
- `components/SimpleStreamEmbedPanel.tsx` is a simpler read-only embed/player.
- `components/BitClawClient.tsx` owns BitClaw social behavior.
- `components/BolClawClient.tsx` and `components/PublicStreamClient.tsx` own BolClaw discovery and public room viewing.
- `app/bitclaw/[slug]/page.tsx` redirects to `/bolclaw/[slug]`, so route aliasing currently crosses brands.

## Proven Regressions From History

### `f75e398` Add public BolClaw pages and stream sharing

- Introduced public stream pages and sharing.
- Nezha used `MediaEmbedPanel` and synced `publicMediaUrl` into public stream state.
- Public stream pages also used `MediaEmbedPanel` in read-only mode.

### `16511cc` Restore Nezha chat and unblock chart embeds

- Nezha-specific chat disappeared during shared page edits.
- This commit restored a route-specific split:
  - `Tianshi` kept `AutonomousStatusPreviewPanel`
  - `Nezha` got `PublicChatPanel`
- Lesson: if a shared page uses a `variant` switch, page-only UI can vanish during unrelated edits.

### `498fda8` Simplify stream embeds and chart actions

- Replaced `MediaEmbedPanel` with `SimpleStreamEmbedPanel` inside `components/TianshiClient.tsx`.
- Replaced `MediaEmbedPanel` with `SimpleStreamEmbedPanel` inside `components/PublicStreamClient.tsx`.
- Result:
  - Tianshi became simpler.
  - Nezha lost the richer media workspace and direct media editing flow.
  - BolClaw public pages also lost the richer resolver fallback path.
- This is the clearest example of a shared-component change propagating farther than intended.

### `0997150` Restore Tianshi chart payment flow

- Added a large Tianshi-only chart payment flow inside `components/TianshiClient.tsx`.
- The feature was mostly gated behind `isTokenControlPage`, but the implementation still expanded the shared monolith instead of introducing a Tianshi-owned adapter.
- Lesson: even correct route-gated behavior can increase coupling if it lives in the shared page component.

### `01d42a4` Finish BitClaw BolClaw rename and job payments

- Added `/bitclaw` and `/bolclaw`.
- Turned `/bitclaw` and `/bolclaw` into aliases.
- Added `app/bitclaw/[slug]/page.tsx` as a redirect to `/bolclaw/[slug]`.
- Lesson: aliases and brand renames are routing concerns, not proof that the underlying interface contract is shared.

### `ea96b92` Harden runtime and roll shared frontend to four app hosts

- Reworked BitClaw into a fuller social graph with:
  - following feed
  - follow actions
  - likes
  - replies
  - viewer identity/profile flows
- These changes were BitClaw-specific and lived in `components/BitClawClient.tsx`.
- Lesson: a capability can be intentionally single-interface even if another surface is adjacent in the product story.

## Recommended Interface Decomposition

### Shared Interface Components

- `SiteNav`
- `RouteHeader`
- `StatusBadge`
- `PriceChart`
- a read-only stream/player primitive

These should stay capability-thin and not own route semantics.

### Single Interface Components

- `TIANSHI.CHART_PAYMENTS`
- `TIANSHI.PUBLIC_HEARTBEAT`
- `MYCLAW.MEDIA_WORKSPACE`
- `MYCLAW.PUBLIC_STREAM_SETTINGS`
- `MYCLAW.BRIDGE_CHAT`
- `BITCLAW.SOCIAL_GRAPH`
- `BOLCLAW.ROOM_INDEX`
- `BOLCLAW.PUBLIC_ROOM_PAGE`

### Sub-Interfaces Worth Naming Explicitly

- `SUBINTERFACE://MEDIA_WORKSPACE`
- `SUBINTERFACE://READ_ONLY_STREAM_PLAYER`
- `SUBINTERFACE://PUBLIC_STREAM_SETTINGS`
- `SUBINTERFACE://SOCIAL_GRAPH`
- `SUBINTERFACE://ROOM_DISCOVERY`
- `SUBINTERFACE://QUEUE_AND_PAYMENTS`

## Practical Guardrails

- Do not let `variant` branches be the only boundary between two interfaces.
- Prefer `TianshiPageClient`, `NezhaPageClient`, `BitClawPageClient`, `BolClawPageClient` wrappers or adapters if behavior keeps drifting.
- Treat route aliases as URL compatibility only.
- If a shared component change removes controls, compare the old capability set before keeping the simplification.
- Add route-level regressions for page-specific affordances:
  - Nezha media controls
  - Nezha bridge chat
  - BitClaw follow/like/reply flows
  - BolClaw room index and room page behavior
