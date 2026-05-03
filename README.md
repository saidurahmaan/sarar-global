# storefront-paperbase

Next.js storefront for [Paperbase](https://paperbase.me): catalog, cart, checkout, orders, blog, and localized pages. Server routes proxy and authenticate against the Paperbase backend using your publishable key.

## Stack

- **Next.js** 16 (App Router, Turbopack in dev)
- **React** 19, **TypeScript**, **Tailwind CSS** 4
- **next-intl** — locales `en` and `bn` (locale prefix always on; routes live under `/[locale]/…`)

## Prerequisites

- Node.js 20+ (matches `@types/node` in this repo)
- npm, pnpm, yarn, or bun

## Environment variables

Create a `.env.local` (not committed) with:

| Variable | Required | Description |
|----------|----------|-------------|
| `PAPERBASE_API_URL` | Yes | Full API base URL, e.g. `http://localhost:8000/api/v1` or `https://api.paperbase.me/api/v1`. |
| `PAPERBASE_PUBLISHABLE_KEY` | Yes | Storefront publishable key (must start with `ak_pk_`). |
| `NEXT_PUBLIC_SITE_URL` | For cache warming / revalidation | Production storefront origin, e.g. `https://yourstore.com` (no trailing slash). Used by `npm run warm-cache` and `/api/revalidate`. |

Copy [`.env.example`](.env.example) to `.env.local` and fill in your key. In local development, `tracker.js` calls are proxied through `/api/tracker` (no extra env vars). Client `apiFetch` targets same-origin `/api/v1/*`, matching the Paperbase API path prefix.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to a locale-prefixed path (e.g. `/en`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with Turbopack |
| `npm run build` | Production build |
| `npm start` | Start production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run warm-cache` | Post-deploy: GETs sitemap and critical URLs (with optional Paperbase API fallback) so CDN edges cache fresh HTML. Requires `NEXT_PUBLIC_SITE_URL`; uses `PAPERBASE_*` when the sitemap is unavailable. See [`scripts/warm-cache.ts`](scripts/warm-cache.ts). |

## Cache warming (production)

After a **successful Vercel production deployment**, GitHub Actions can run the warmer automatically so users rarely hit a cold CDN cache.

- **Workflow:** [`.github/workflows/warm-cache.yml`](.github/workflows/warm-cache.yml)
- **Trigger:** `deployment_status` — only when `state == success` and `environment == Production` (Preview deploys are ignored).
- **Timeout:** 10 minutes per run.

Configure these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SITE_URL` | Production storefront URL (same as the env var). |
| `PAPERBASE_API_URL` | Paperbase API base URL for fallback product/category discovery. |
| `PAPERBASE_PUBLISHABLE_KEY` | Storefront publishable key (`ak_pk_…`). |

Locally you can run `npm run warm-cache` with the same variables set in `.env.local` or the shell.

## Fork sync (maintainers)

This repository can include a GitHub Action (`.github/workflows/sync-fork.yml`) that triggers upstream merges on `master` for configured fork repositories. Configure the matrix of fork repos and a `PAT_TOKEN` secret with permissions to call the GitHub merge-upstream API on those forks.

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [next-intl](https://next-intl-docs.vercel.app/)
