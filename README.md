# OneTap

Multi-tenant restaurant platform. One codebase renders many restaurants, each themed and
feature-toggled entirely from the admin panel.

## Stack

| Part | Tech | Dev port |
| --- | --- | --- |
| `apps/storefront` | Next.js (App Router) — customer site | **3070** |
| `apps/admin` | React + Vite SPA — admin / CMS / counter billing | **3071** |
| `apps/api` | Node + Express (TypeScript) + MongoDB | **3072** |
| `packages/config-schema` | Zod schemas for tenant config (shared) | — |
| `packages/db` | Mongoose models + the tenant-scoping plugin | — |
| `packages/ui` | Shared component library + design tokens | — |

## Prerequisites

- Node ≥ 20.9 (24 recommended — see `.nvmrc`)
- pnpm (`npm i -g pnpm`)
- MongoDB — either a local install, or a **MongoDB Atlas** connection string in
  `apps/api/.env` (use a dedicated dev database, never a shared cluster).
  The API runs without a database — endpoints that need one will report `db: disconnected`.

## Getting started

```bash
pnpm install

# copy env templates (already created for local dev; edit apps/api/.env for Atlas)
cp apps/api/.env.example apps/api/.env          # if missing
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/admin/.env.example apps/admin/.env

pnpm dev            # starts all three apps via Turborepo
```

Then:

- Storefront → http://localhost:3070
- Admin → http://localhost:3071
- API health → http://localhost:3072/health

In the admin, click **Seed Gazab Momos demo** to create the first brand + outlet
(requires MongoDB connected).

## Individual apps

```bash
pnpm dev:api
pnpm dev:storefront
pnpm dev:admin
```

## Secrets

Never commit secrets. `.env` files are git-ignored. Restaurant payment keys,
SMTP credentials, etc. are entered in the admin panel and stored encrypted in MongoDB —
they never live in code or env files in production.
