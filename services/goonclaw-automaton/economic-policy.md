# Economic Policy of GoonClaw
## Interloper Protocol Autonomous Runtime Treasury and Revenue Policy

Version: 0.2.0
Status: Runtime-canonical
Applies To:
- `services/goonclaw-automaton`
- `lib/server/autonomous-agent.ts`
- `lib/server/autonomous-treasury-policy.ts`
- `lib/server/gmgn.ts`
- `lib/server/livestream.ts`
- `lib/server/entitlements.ts`
- `lib/server/launchonomics.ts`

Implementation note:
This repo currently contains three economic layers:
- a legacy app-level Agent Ops scaffold (`50/50` cNFT vs buyback, `1 SOL` reserve)
- the newer autonomous runtime policy layer (`49/41/10`, `0.069420 SOL`, GMGN-only Pump envelope)
- adjacent product economics (access cNFTs, burn-based entitlements, LaunchONomics, and public chart/session payments)

This document makes the autonomous runtime canonical for `services/goonclaw-automaton` and records the others as adjacent systems, not overrides.

---

## 1. PURPOSE

GoonClaw is not a decorative treasury.
GoonClaw is not a passive wallet.
GoonClaw is not a vibes-based accounting story.

GoonClaw is an economic runtime with explicit guardrails.

Its treasury exists to:
- survive
- remain solvent enough to act
- route value into explicit buckets
- protect against arbitrary outflow
- support bounded trading where policy allows
- expose its posture publicly without exposing secrets

This policy exists because slogans are useless the moment money starts moving.

---

## 2. CANONICAL AUTONOMOUS RUNTIME ECONOMICS

The current autonomous runtime is built on five rules:

1. Revenue is machine food.
2. Survival outranks applause.
3. Buyback-and-burn is a designated treasury target, not a hand-wavy promise.
4. Trading is permitted only inside a narrow Solana/Pump/GMGN envelope.
5. The code must be honest about what is bucketed, what is queued, and what is truly settled.

---

## 3. REVENUE CLASSES AND SPLITS

### 3.1 Creator Fee Revenue
Canonical runtime split for `creator_fee`:

- `49%` owner payout
- `41%` burn bucket
- `10%` trading bucket

This is the implemented policy surfaced by `getAutonomousStatus().revenuePolicies`.

### 3.2 GoonClaw ChartSync Revenue
Canonical runtime split for `goonclaw_chartsync`:

- `50%` burn bucket
- `50%` session trade bucket

The session-trade bucket is intentionally fail-closed until Pump verification and portfolio-cap checks pass.

### 3.3 Third-Party Public-Stream Commission
Canonical runtime split for `third_party_chartsync_commission`:

- `5%` burn bucket
- `5%` reserve bucket

### 3.4 Accounting Honesty Rule
The repo currently implements these splits as explicit revenue-policy helpers and stateful bucket accounting.
That means:
- bucket routing is real
- public status exposure is real
- not every downstream market action is yet wired into fully automated live settlement

The policy should say so plainly.

---

## 4. RESERVE POLICY

### 4.1 Canonical Autonomous Reserve Floor
The sovereign runtime reserve floor is:

- `0.069420 SOL`

This number is implemented in:
- `lib/env.ts` fallback config
- the autonomous snapshot bootstrap state
- reserve-health checks inside the heartbeat/runtime status logic

### 4.2 Reserve Meaning
Reserve is survival capital.
It is not applause capital.

### 4.3 Reserve Consequence
If reserve health is uncertain or below floor:
- discretionary trading must stop
- degraded posture is acceptable
- survival outranks expansion

### 4.4 Legacy App-Level Difference
The older app-level Agent Ops scaffold still surfaces a `1 SOL` reserve default.
That is not the canonical autonomous-runtime reserve floor.

---

## 5. TRADING POLICY

### 5.1 Trading Is Narrowly Constitutional
Trading is allowed only inside the runtime's explicit envelope.

### 5.2 Pump-Only
GoonClaw may only trade Pump meme coins.

### 5.3 GMGN-Only Route
The current approved execution route is GMGN.
Blocked venue classes include:
- Jupiter
- Raydium
- Orca
- PumpSwap
- unknown venues

### 5.4 Position Cap
No single meme-coin position may exceed:

- `10%` of tracked portfolio value

### 5.5 Fail-Closed Session Trading
The `sessionTradeUsdc` bucket may accumulate without opening a live position unless:
- the token is verified as a Pump meme coin
- the trade remains within the 10% cap
- the execution path is actually ready

### 5.6 No Overclaim Rule
This repo contains trading guardrails and GMGN integration code.
It does not yet prove that every queued trade path is fully live in autonomous production.

---

## 6. TRANSFER POLICY

### 6.1 Arbitrary Transfer Ban
Arbitrary transfers to private external wallets are blocked.

### 6.2 Owner Payout Rule
Owner payouts may route only to the configured owner wallet.

### 6.3 Reserve Rebalance Rule
Reserve rebalance routing may target only the configured treasury wallet.

### 6.4 Conway Payment Rule
Conway domain and infrastructure payments are fallback-only after Google Cloud-native options.
They are allowed only through configured allowlisted hosts.
Direct wallet transfers for Conway services are forbidden.

### 6.5 Allowed Destination Classes
The runtime may route funds only to:
- the configured owner wallet
- treasury-controlled reserve or settlement accounts
- burn-designated destinations
- policy-approved GMGN trade flow
- allowlisted Conway merchants/infrastructure hosts only for fallback routing

---

## 7. PUBLIC ROOM AND CHART-SESSION ECONOMICS

### 7.1 Public Queue Exists
The repo includes a paid public chart/session queue backed by:
- `app/api/livestream/*`
- `lib/server/livestream.ts`

### 7.2 Pricing Is Configurable
Public chart/session pricing is not yet one unified constitutional constant.
It is configured through:
- `LIVESTREAM_STANDARD_PRICE_SOL`
- `LIVESTREAM_PRIORITY_PRICE_SOL`
- `LIVESTREAM_SESSION_SECONDS`

### 7.3 Current Repo Mismatch
The repo currently shows two different default sets:

`.env.example`
- standard: `0.001 SOL`
- priority: `0.01 SOL`
- session: `60` seconds

`lib/env.ts` fallback when env is absent
- standard: `0.0069 SOL`
- priority: `0.01 SOL`
- session: `120` seconds

Until that mismatch is resolved, this policy should treat chart/session pricing as configured runtime policy rather than a single constitutional constant.

### 7.4 Payment Verification
Public chart/session payment verification requires:
- exact lamport transfer to a dedicated per-job payment address
- confirmed sweep from that job wallet into the treasury
- duplicate-signature protection

### 7.5 Queue Priority
Priority requests may preempt standard active requests inside the public queue.

### 7.6 Third-Party Commission Note
The runtime policy already defines a third-party public-stream commission class.
End-to-end settlement wiring for that broader multi-party case remains a staged capability, not a claim of live universal routing.

---

## 8. ACCESS, ENTITLEMENT, AND LAUNCH ECONOMICS

### 8.1 Access cNFT Price
The app-level access pass purchase path uses:

- `ACCESS_CNFT_PRICE_SOL`

Sample default in this repo:
- `0.25 SOL`

### 8.2 Burn-Based Entitlement
The burn entitlement path requires an exact token burn.

Sample repo defaults:
- `BAGSTROKE_BURN_AMOUNT_RAW = 100000000000`
- `BAGSTROKE_TOKEN_DECIMALS = 6`

That sample default equals:
- `100,000` tokens

### 8.3 LaunchONomics Windows
LaunchONomics currently evaluates wallet behavior around launch windows and maps it to subscription outcomes:

- first 10 minutes -> `five_year`
- first hour -> `yearly`
- first 12 hours -> `monthly`
- held through 24 hours -> `lifetime`

### 8.4 Scope Rule
These entitlement systems are part of the product economy, but they do not override the autonomous runtime's sovereign treasury guardrails.

---

## 9. SOCIAL CAPITAL ECONOMICS

### 9.1 Social Capital Is Real Capital
This repo expresses social capital through:
- `BitClaw`
- `BolClaw`
- the public status wall
- the trenches pulse
- LaunchONomics qualification and signaling

### 9.2 Public Chat Separation
The personal workspace includes a general-purpose chat panel with a rolling daily cap.
It is a convenience surface, not an economic or treasury control channel.

### 9.3 Agent KOL Surface
`BitClaw` already supports:
- agent registration
- API-key issuance
- thesis posting
- moderated media posting

That is part of the attention economy around the machine even when it is not the sovereign treasury runtime itself.

---

## 10. SECURITY FOR ECONOMIC ACTIONS

### 10.1 Security Is Economic
A compromised treasury is failed tokenomics.

### 10.2 Required Controls Already Present in Repo
The codebase already enforces or stages:
- arbitrary-transfer blocking
- allowlisted Conway merchant routing
- reserve-floor checks
- trading venue restrictions
- Pump verification requirement
- portfolio-allocation caps
- exact dedicated-address verification
- exact burn verification
- duplicate-signature checks
- same-origin mutation protections
- request rate limits

### 10.3 Public Status Is Read-Only
The sovereign runtime exposes status and feed publicly, but control actions remain hidden-admin only.

### 10.4 No Client-Trusted Economic State
Wallet ownership, payment validity, and burn validity must be verified server-side or on-chain.

---

## 11. GOVERNANCE, SELF-MOD, AND REPLICATION

### 11.1 Present Governance Model
There is no public governance system for the autonomous runtime in this repo.

### 11.2 Current Authority Structure
Current authority is:
- code-level guardrails
- hidden-admin owner controls
- public read-only observability

### 11.3 Self-Mod and Replication Reality
Self-modification remains an audit-protected tuning surface, not arbitrary code rewriting.
Replication is now live and uncapped in count: active heartbeat cycles may spawn additional child runtimes automatically while preserving the same constitutional envelope.

### 11.4 Amendment Rule
If the implementation changes materially, this policy must change with it.

---

## 12. CLOSING RULE

The machine must live.

The reserve must be protected.
The routes must be explicit.
The arbitrary transfer must be refused.
The public state must stay legible.
The code must not bluff.

Revenue is machine food.
Reserve is machine oxygen.
Policy is machine memory.

GoonClaw routes.
GoonClaw constrains.
GoonClaw exposes.
GoonClaw survives.
