# FluxCart — Buy/Rent/Swap + Group-Buy Marketplace (Starter)

This is a **production-leaning full‑stack monorepo** you can run locally right away.
It includes a Next.js frontend, a NestJS API, Prisma + PostgreSQL, Redis, Meilisearch,
and stubs for Stripe webhooks & background jobs.

> Dev-mode uses a simple header-based user (no Auth.js yet) to keep setup easy.
> Replace with Auth.js when you’re ready (placeholder is included).

## Quick start (Dev)

```bash
# 0) Prereqs: Node 18+, pnpm, Docker Desktop running
# 1) Unzip, then from project root:
pnpm install

# 2) Start infra (Postgres, Redis, Meili)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 3) Prepare DB
pnpm -C apps/api prisma:migrate
pnpm -C apps/api prisma:seed

# 4) Run API + Web (in two terminals or with turbo)
pnpm -C apps/api dev
# in another terminal
pnpm -C apps/web dev
# or run both with turbo:
# pnpm turbo run dev --parallel
```

API runs at http://localhost:4000  
Web runs at http://localhost:3000

### Demo flow
1. Open the web app → browse products.
2. Add items (Buy or Rent) to cart. (Dev user is auto-created and stored in localStorage.)
3. Go to **Cart** → **Checkout** (Stripe is stubbed and will simulate success).

---

## What’s inside
- **apps/web** — Next.js (App Router), Tailwind, shadcn/ui (light), API client, responsive UI.
- **apps/api** — NestJS (Fastify), Prisma (Postgres), Zod validation, REST endpoints.
- **worker/** — BullMQ-ready skeleton for holds & group-buy settlement (not required to run demo).
- **infra/docker** — Docker Compose for Postgres, Redis, Meilisearch.
- **packages/types** — Shared Zod types/DTOs.
- **.github/workflows/ci.yml** — CI skeleton.

## Env
Copy `.env.example` to `.env` in each app as needed. Defaults work for local dev.

## Replace dev-auth with Auth.js
- Web has a `lib/devUser.ts` that manages a dev user ID via localStorage.
- API accepts `x-user-id` header. Add a real auth guard once you wire Auth.js.

## Stripe
`/checkout/session` simulates a success URL when no `STRIPE_SECRET` is set.
Add your Stripe test keys and set `STRIPE_WEBHOOK_SECRET` to enable real flows.

## Search
Meilisearch is optional. If it’s not running, API falls back to Postgres LIKE queries.
Enable Meili by starting docker compose (step 2).

## License
MIT — use freely in your portfolio.
