# FixIt — Architecture

> Phase 1 uses **Prisma + SQLite** because of the current execution environment. The
> product is intentionally structured behind service/provider boundaries so
> PostgreSQL/Supabase can be introduced later without replacing the core domain and
> product architecture. This is an intentional engineering tradeoff, not something
> that is hidden.

## 1. Product

FixIt is a home & equipment troubleshooting platform. The core journey:

```
Problem → Diagnose → Safe troubleshooting → Decide → Professional help
       → Match → Book → Track repair → Complete → Review → Warranty/history
```

The diagnostic engine is **deterministic and data-driven** (no AI in Phase 1).
AI is a Phase 9 concern and is gated behind an `AIProvider` abstraction that is
defined but unimplemented.

## 2. Layered architecture

```
UI (React 19 + shadcn/ui, hash-routed single `/`)
        │  fetch('/api/...')  +  socket.io
        ▼
API routes  (src/app/api/**)
  • NextAuth session validation
  • Server-side authorization (ownership + role)
  • Zod input validation
        ▼
Domain services  (src/services/**)
  • DiagnosticEngine, MatchingEngine, BookingStateMachine,
    RepairJobStateMachine, QuoteService, PaymentService,
    ReviewService, WarrantyService, NotificationService
  • Pure business rules; no HTTP/DB details leak here
        ▼
Repositories  (src/repositories/**)
  • Typed Prisma access per aggregate
        ▼
Prisma Client  (src/lib/db.ts)  →  SQLite
```

## 3. Provider abstractions (`src/lib/providers/`)

| Provider        | Phase 1 impl             | Swap target         |
|-----------------|--------------------------|---------------------|
| DatabaseProvider| Prisma + SQLite          | Supabase / Postgres |
| StorageProvider | LocalStorageProvider     | Supabase / S3       |
| RealtimeProvider| Socket.io mini-service (:3003) | Supabase Realtime |
| PaymentProvider | MockPaymentProvider      | Stripe / Chapa      |
| AIProvider      | **disabled** (throws notImplemented) | z-ai-web-dev-sdk / OpenAI (Phase 9) |

Each provider is behind an interface in `src/lib/providers/*.ts`. The feature layer
never imports a concrete provider directly — it imports the interface from
`src/lib/providers/index.ts`, which resolves the active implementation.

## 4. Authorization model

NextAuth Credentials + Prisma adapter. Roles: `CUSTOMER`, `TECHNICIAN`, `ADMIN`.

Authorization is enforced **server-side** in the API routes and services:

- Customers can only read/write their own equipment, sessions, requests, bookings,
  payments, reviews, warranties, notifications.
- Technicians can only access requests/jobs/quotes assigned to or matchable by them,
  plus the customer/job info required to perform the work.
- Admin has privileged access per explicit policy.

Client-side UI checks hide/show actions for UX only — they are **never** the
authorization boundary.

## 5. Routing

Single user-visible Next.js route: `/`. Internal navigation uses a Zustand store
synchronized with `window.location.hash`:

```
/#/home
/#/diagnose
/#/diagnose/session/<id>
/#/technicians
/#/technicians/<id>
/#/booking/<id>
/#/repair/<id>
/#/history
/#/warranties
/#/equipment
/#/notifications
/#/admin
/#/technician
/#/auth/signin
/#/auth/signup
```

Back/forward works via `hashchange`. Deep links are shareable. State for in-flight
diagnostic sessions is persisted to the DB so a user can leave and return.

## 6. Realtime

A socket.io mini-service runs on port `3003` (`mini-services/realtime/`). The
frontend connects via `io("/?XTransformPort=3003")` (Caddy gateway rule). Used only
where it provides real UX value:

- booking status changes
- repair job status transitions
- quote submitted / approved / rejected
- notifications

## 7. Media storage

`StorageProvider` interface. Phase 1: `LocalStorageProvider` writes to a configurable
directory (`UPLOAD_DIR` env, default `./uploads`). Files are served through an
**authenticated** `/api/uploads/[id]` route that checks ownership/role before
streaming bytes. Filenames are randomized; the original name is stored as metadata.
Files are never served directly from the filesystem.

## 8. Payments

`PaymentProvider` interface. Phase 1: `MockPaymentProvider` — creates a `Payment`
record with `PENDING`, simulates a "capture" that flips it to `SUCCEEDED`, and
records a fake `providerRef`. Clearly labeled as sandbox/mock in the UI. The
abstraction means Stripe/Chapa can be added later without touching the feature layer.

## 9. Geographic matching

Service areas are stored with lat/lng. Customer profiles optionally carry lat/lng.
Matching uses Haversine straight-line distance. The `GeoService` is abstracted so a
real geocoding provider can replace the demo coordinates later. Real user addresses
are never required or exposed.

## 10. Currency

All monetary amounts stored as integer minor units (e.g. cents) in the `amount`
fields, with a `currency` field defaulting to `"ETB"`. Display formatting via
`formatCurrency()` in `src/lib/format.ts` → `ETB 1,500`.

## 11. AI (Phase 9 only)

`AIProvider` interface exists in Phase 1 but its methods throw `notImplemented`.
No UI advertises AI. The diagnostic engine is fully deterministic and works without
any AI call. Phase 9 will:

1. validate/moderate user input
2. structured extraction (symptoms/equipment)
3. deterministic engine still runs
4. AI assistance where appropriate
5. safety/policy layer constrains output
6. final recommendation

AI output never becomes executable application logic directly.

## 12. Directory layout

```
src/
  app/
    api/            # route handlers (auth, domain endpoints)
    layout.tsx
    page.tsx        # single user-visible route, mounts <AppShell/>
    globals.css
  components/
    ui/             # shadcn/ui (pre-installed)
    app/            # app shell, header, nav, footer
    shared/         # status badges, empty states, loading, etc.
  features/
    auth/
    dashboard/
    equipment/
    diagnose/
    marketplace/
    bookings/
    repairs/
    reviews/
    warranties/
    history/
    notifications/
    admin/
    technician/
  lib/
    db.ts
    auth.ts
    format.ts
    geo.ts
    providers/
    utils.ts
  services/
  repositories/
  types/
  hooks/
  store/            # zustand stores (router, session, ui)
mini-services/
  realtime/         # socket.io :3003
prisma/
  schema.prisma
  seed/
docs/
  ARCHITECTURE.md
  ROADMAP.md
  DATABASE.md
  CHANGELOG.md
README.md
```
