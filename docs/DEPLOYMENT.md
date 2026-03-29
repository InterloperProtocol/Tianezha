# Tianezha Deployment Guide

## Hosting Model

The repository is configured for Firebase App Hosting.

Data separation is now namespace-based:

- local development and test default to `TIANEZHA_DATA_NAMESPACE=testnet`
- App Hosting production is pinned to `TIANEZHA_DATA_NAMESPACE=mainnet`
- Firestore data is stored under `tianezhaEnvironments/{namespace}/...`
- Payload SQLite files are namespaced per environment so testnet writes never reuse the mainnet database file

Relevant files:

- `firebase.json`
- `apphosting.yaml`
- `firestore.rules`
- `firestore.indexes.json`

Primary backend in this repo:

- `tianshi`

Additional backends listed in Firebase config:

- `bolclaw-fun`
- `trenchstroker-fun`
- `outoforder-fun`

## Release Checklist

1. Install dependencies.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Run `npm run build` with production-safe env values available.
6. Verify App Hosting secrets are present.
7. Verify `TIANEZHA_DATA_NAMESPACE` points at the intended lane before release.
8. Commit and push the branch you want to release.
9. Deploy through Firebase App Hosting.

## Required Secrets And Runtime Values

At minimum, production needs:

- `APP_SESSION_SECRET`
- `PAYLOAD_SECRET`
- `DEVICE_CREDENTIALS_AES_KEY`
- `WORKER_TOKEN`
- `INTERNAL_ADMIN_PASSWORD`
- `TIANEZHA_ALLOWED_MUTATION_ORIGINS` when App Hosting serves a public origin that differs from the request URL observed inside the runtime

Depending on enabled features, you may also need:

- Firebase Admin credentials or `FIREBASE_CONFIG`
- Vertex AI configuration
- Telegram bot configuration
- GMGN, Helius, Birdeye, Hyperliquid, Polymarket, or other integration secrets

## Local Production Build Note

`next build` runs with `NODE_ENV=production`, so the repo will fail fast if production-required secrets are missing.

That is expected behavior. For a local verification build, use temporary non-empty secrets that satisfy the validators.

Example PowerShell session:

```powershell
$env:APP_SESSION_SECRET = "local-build-secret-1234"
$env:PAYLOAD_SECRET = "local-build-secret-1234"
$env:DEVICE_CREDENTIALS_AES_KEY = "local-device-secret-1234"
$env:WORKER_TOKEN = "local-worker-secret-1234"
npm run build
```

## Firebase App Hosting Notes

- `apphosting.yaml` defines runtime env values and secret bindings
- `firebase.json` defines App Hosting backends and ignore patterns
- the repo already assumes App Hosting is the intended production path
- keep `TIANEZHA_ALLOWED_MUTATION_ORIGINS` aligned with the public hosted domain or custom domain that browsers use for state-changing requests

## Recommended Deploy Flow

If you are authenticated with Firebase CLI:

```bash
firebase deploy --only apphosting:tianshi
```

If multiple environments/backends are active, verify the correct project and backend before deploying.
For Tianezha production, the intended backend stays on `mainnet`; ongoing QA and regression data should remain in the `testnet` namespace until mainnet launch is ready to become the source of truth.

## Known Warnings

- Next.js may emit a warning about an unrecognized `turbopack` key when wrapped by Payload on older 15.2-era versions. Payload documents this as safe to ignore until the framework is upgraded.
- Some third-party packages emit optional native-binding warnings during build. Those should be evaluated case by case, but they did not block lint, typecheck, or test in the current review pass.
