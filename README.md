# FixIt

> Something broke. I don't know what is wrong, whether I can safely fix it myself,
> what it should cost, or who I can trust to repair it.
>
> FixIt turns that uncertainty into a guided workflow:
> **Problem → Diagnose → Safe troubleshooting → Decide → Professional help →
> Match → Book → Track repair → Complete → Review → Warranty/history**

FixIt is a home & equipment troubleshooting platform. The first goal is
**understanding the problem**, not selling a service. The diagnostic engine is
deterministic and data-driven (no AI in Phase 1).

## Status

Phase 1 — a complete, deterministic, AI-free product. See `docs/ROADMAP.md`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York, neutral)
- Prisma + SQLite (Phase 1; provider-abstraction makes a Supabase/Postgres swap
  mechanical — see `docs/ARCHITECTURE.md`)
- NextAuth v4 (Credentials + Prisma adapter), bcrypt, roles
- Zustand (client) + TanStack Query (server) + react-hook-form + zod
- Socket.io mini-service for realtime job/booking updates
- lucide-react, recharts, framer-motion

## Architecture

```
UI → API routes (authz + zod) → domain services → repositories → Prisma → SQLite
```

Provider abstractions (`src/lib/providers/`): Database, Storage, Realtime, Payment,
AI (disabled in Phase 1). See `docs/ARCHITECTURE.md`.

## Run

```bash
bun install
bun run db:push        # create SQLite schema
bun run db:seed        # seed demo data (see below)
bun run dev            # http://localhost:3000 (preview via the Preview Panel)
```

The realtime mini-service lives in `mini-services/realtime/` and is started
automatically alongside the app during development.

## Demo credentials (seeded)

> These are synthetic demo accounts for portfolio evaluation only.

| Role     | Email                  | Password    |
|----------|------------------------|-------------|
| Admin    | admin@fixit.demo       | fixit-admin |
| Customer | customer@fixit.demo    | fixit-cust  |
| Technician | tech@fixit.demo      | fixit-tech  |

New customers/technicians can also self-register.

## Geography & currency

Demo city: **Addis Ababa, Ethiopia**. Service areas: Bole, Kazanchis, Piazza,
Arada, Kirkos, Yeka, Lideta, Nifas Silk-Lafto, Kolfe Keranio, Gulele. Currency:
**ETB** (e.g. `ETB 1,500`). Distance: straight-line km from stored lat/lng.

## Important note on Phase 1 scope

Phase 1 uses Prisma + SQLite because of the current execution environment. The
product is intentionally structured behind service/provider boundaries so
PostgreSQL/Supabase can be introduced later without replacing the core domain and
product architecture. AI is **not** integrated in Phase 1 — the `AIProvider`
abstraction exists but throws `notImplemented`. No UI advertises AI.

## Documentation

- `docs/ARCHITECTURE.md` — layered architecture, providers, authz, routing.
- `docs/ROADMAP.md` — phased plan.
- `docs/DATABASE.md` — schema, state machines, authorization.
- `docs/CHANGELOG.md` — changes per milestone.
