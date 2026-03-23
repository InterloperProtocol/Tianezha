# Third-Party Notices

This repository is licensed under the MIT License. Third-party software
included with, bundled into, or required by this project remains subject to
its own license terms.

## Bundled Runtime Tools

The following third-party artifacts are checked into this repository under
`runtime-tools/`:

| Component | Version | License |
| --- | --- | --- |
| Deno | 2.6.4 | MIT |
| yt-dlp | 2025.12.08 | Unlicense |

## Direct Runtime Dependencies

The main application currently depends on these direct runtime packages:

| Package | Version | License |
| --- | --- | --- |
| `@dexterai/x402` | `2.0.0` | MIT |
| `@google/genai` | `1.46.0` | Apache-2.0 |
| `@metaplex-foundation/mpl-bubblegum` | `5.0.2` | Apache-2.0 |
| `@metaplex-foundation/mpl-token-metadata` | `3.4.0` | Apache-2.0 |
| `@metaplex-foundation/umi` | `1.5.1` | MIT |
| `@metaplex-foundation/umi-bundle-defaults` | `1.5.1` | MIT |
| `@payloadcms/db-sqlite` | `3.79.1` | MIT |
| `@payloadcms/next` | `3.79.1` | MIT |
| `@pump-fun/agent-payments-sdk` | `3.0.2` | ISC |
| `@pump-fun/pump-sdk` | `1.31.0` | MIT |
| `@solana-agent-kit/adapter-mcp` | `2.0.7` | Apache-2.0 |
| `@solana-agent-kit/plugin-defi` | `2.0.8` | Apache-2.0 |
| `@solana-agent-kit/plugin-misc` | `2.0.6` | Apache-2.0 |
| `@solana-agent-kit/plugin-token` | `2.0.9` | Apache-2.0 |
| `@solana/spl-token` | `0.4.14` | Apache-2.0 |
| `@solana/wallet-adapter-base` | `0.9.27` | Apache-2.0 |
| `@solana/wallet-adapter-phantom` | `0.9.28` | Apache-2.0 |
| `@solana/wallet-adapter-react` | `0.15.39` | Apache-2.0 |
| `@solana/wallet-adapter-react-ui` | `0.9.39` | Apache-2.0 |
| `@solana/wallet-adapter-solflare` | `0.6.32` | Apache-2.0 |
| `@solana/web3.js` | `1.98.4` | MIT |
| `adm-zip` | `0.5.16` | MIT |
| `bs58` | `6.0.0` | MIT |
| `clsx` | `2.1.1` | MIT |
| `fast-xml-parser` | `5.5.7` | MIT |
| `fastify` | `5.8.2` | MIT |
| `firebase-admin` | `13.7.0` | Apache-2.0 |
| `hls.js` | `1.6.15` | Apache-2.0 |
| `ive-connect` | `1.1.0` | MIT |
| `lightweight-charts` | `5.1.0` | Apache-2.0 |
| `next` | `15.2.9` | MIT |
| `payload` | `3.79.1` | MIT |
| `react` | `19.2.3` | MIT |
| `react-dom` | `19.2.3` | MIT |
| `solana-agent-kit` | `2.0.10` | Apache-2.0 |
| `solana-mcp` | `1.0.1` | MIT |
| `tweetnacl` | `1.0.3` | Unlicense |
| `zod` | `3.25.76` | MIT |

## Direct Development Dependencies

The repository also uses these direct development-only packages:

| Package | Version | License |
| --- | --- | --- |
| `@tailwindcss/postcss` | `4.2.2` | MIT |
| `@types/adm-zip` | `0.5.8` | MIT |
| `@types/node` | `20.19.37` | MIT |
| `@types/react` | `19.2.14` | MIT |
| `@types/react-dom` | `19.2.3` | MIT |
| `eslint` | `9.39.4` | MIT |
| `eslint-config-next` | `15.2.9` | MIT |
| `helius-mcp` | `1.3.0` | MIT |
| `playwright` | `1.58.2` | Apache-2.0 |
| `tailwindcss` | `4.2.2` | MIT |
| `tsx` | `4.21.0` | MIT |
| `typescript` | `5.9.3` | Apache-2.0 |
| `vitest` | `3.2.4` | MIT |

## Source of Truth

Version numbers above were generated from the checked-in `package.json`,
`package-lock.json`, and installed package metadata at release time. Full
license texts for installed npm dependencies are available from the respective
packages in `node_modules/`. Bundled binary licenses should be obtained from
their upstream projects if additional notice text is required for redistribution.
