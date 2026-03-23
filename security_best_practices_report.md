# Security Best Practices Report

## Executive Summary

The codebase is materially stronger than the earlier snapshot. The public media resolver now blocks private and metadata targets, the livestream request and verification routes now have request throttling, and the public chat endpoint now has a server-side burst limiter in addition to the signed cookie counter. The main issues that still stand are a permissive CSP and the fact that rate limiting remains in-process rather than durable across instances.

## Medium Severity

### Finding 1

- Rule ID: NEXT-HEADERS-002
- Severity: Medium
- Location: `next.config.ts:4-16`
- Evidence:
  - `next.config.ts:12-13` sets `style-src 'self' 'unsafe-inline' https:` and `script-src 'self' 'unsafe-inline' 'unsafe-eval' https:`.
- Impact: The app has a CSP, but it still permits inline script execution, eval-style execution, and any HTTPS script origin. That limits the CSP's value as an XSS containment layer.
- Fix: Move toward a nonce- or hash-based CSP, remove `'unsafe-eval'`, and narrow script origins to the exact hosts the app needs.
- Mitigation: If a strict CSP cannot land immediately, document the exact dependency that requires each relaxation and remove the wildcard HTTPS script allowance first.
- False positive notes: Some tooling may temporarily require relaxed directives, but the current policy is broader than necessary.

### Finding 2

- Rule ID: NEXT-ABUSE-001
- Severity: Medium
- Location: `app/api/public-chat/route.ts:13-68`, `lib/server/public-chat.ts:19-92`
- Evidence:
  - `app/api/public-chat/route.ts:15-21` adds a burst limiter, but the durable usage cap still depends on `reservePublicChatTurn()`.
  - `lib/server/public-chat.ts:19-21` defines the daily quota.
  - `lib/server/public-chat.ts:31-92` stores quota state in a signed browser cookie.
- Impact: The public chat endpoint now has basic server-side burst control, but the 24-hour quota itself is still client-cookie backed. That means a determined attacker can still reset the quota with fresh clients or distribute requests across instances and identities.
- Fix: Move quota accounting to a server-side store keyed by IP, guest session, or another durable identity.
- Mitigation: Keep the current burst limiter in place and add edge throttling or bot controls while a durable quota store is introduced.
- False positive notes: Signed cookies prevent tampering, but they do not make the quota durable across fresh clients.

## Low Severity

### Finding 3

- Rule ID: NEXT-RATE-001
- Severity: Low
- Location: `lib/server/request-security.ts:11-20`, `lib/server/request-security.ts:238-280`
- Evidence:
  - `lib/server/request-security.ts:11-20` stores counters in a process-global `Map`.
  - `lib/server/request-security.ts:238-280` uses that in-memory store for all application-level throttling.
- Impact: Rate limits reset on process restart and do not automatically share state across horizontally scaled instances.
- Fix: Move throttling state to a shared backend such as Redis, Firestore, Cloudflare, or another platform-native limiter.
- Mitigation: Treat the current limiter as a local safety net and pair it with CDN/WAF enforcement.
- False positive notes: This is acceptable for local development and single-instance deployments, but it is not durable production enforcement.

## Notes

1. The earlier SSRF issue on `/api/media/resolve` is now materially reduced by `assertSafeExternalHttpUrl(...)` in `lib/server/request-security.ts` and its use in `app/api/media/resolve/route.ts`.
2. The earlier livestream abuse finding is materially reduced because both queue creation and payment verification routes now apply request throttling.
