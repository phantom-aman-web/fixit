# FixIt — Phase 5 Baseline Audit

> Snapshot of the production readiness of the FixIt codebase at the start of
> Phase 5 (production hardening + deployment documentation). This document is
> the honest inventory against which the rest of `docs/` is written.

## 1. Framework versions (verified from `package.json`)

| Layer                | Library / Tool         | Version      |
|----------------------|------------------------|--------------|
| Runtime              | Node.js                | ≥ 20 (via `bun`) |
| Package manager      | bun                    | ≥ 1.3        |
| Web framework        | next                   | ^16.1.1      |
| React                | react / react-dom      | ^19.0.0      |
| Language             | typescript             | ^5           |
| ORM                  | prisma / @prisma/client| ^6.11.1      |
| Database (dev)       | SQLite                 | via Prisma   |
| Auth                 | next-auth              | ^4.24.11     |
| Auth adapter         | @auth/prisma-adapter   | ^2.11.3      |
| Password hashing     | bcryptjs               | ^3.0.3        |
| Validation           | zod                    | ^4.0.2       |
| Data fetching (UI)   | @tanstack/react-query  | ^5.82.0      |
| State (client)       | zustand                | ^5.0.6       |
| Styling              | tailwindcss            | ^4           |
| Component primitives  | shadcn/ui (Radix)      | (per-component) |
| Realtime             | socket.io              | ^4.8.3       |
| Charts               | recharts               | ^2.15.4      |
| AI                   | z-ai-web-dev-sdk       | ^0.0.18      |
| Build output         | `next build` (standalone) | —         |

## 2. Database — SQLite via Prisma

- Provider: `sqlite` (declared in `prisma/schema.prisma`).
- Connection string: `DATABASE_URL=file:./prisma/dev.db` (default; configurable via env).
- Enum-like fields are stored as `String` because SQLite has no native enum
  type. Validity is enforced by Zod schemas at the service boundary.
- No SQLite-specific column types are used (no `BLOB`, no `INTEGER PRIMARY KEY`
  tricks). The schema is relationally shaped and is mechanically portable to
  PostgreSQL.
- Migrations: today the team uses `prisma db push` (schema push) rather than
  `prisma migrate dev`. There is **no `prisma/migrations/` directory** — see
  `docs/database-production.md` for the migration strategy.

## 3. Auth — NextAuth v4 Credentials + JWT

- `src/lib/auth.ts` configures NextAuth with:
  - `PrismaAdapter(db)` (account/session model compatible).
  - `session: { strategy: "jwt" }` (stateless; no per-request DB session lookup).
  - `CredentialsProvider` (email + bcrypt-hashed password).
  - JWT callback copies `id` + `role` from the user onto the token; session
    callback exposes them on `session.user`.
  - `pages.signIn = "/#/auth/signin"` (hash-routed UI).
- Roles: `CUSTOMER`, `TECHNICIAN`, `ADMIN`. New registrations default to
  `CUSTOMER`; technicians register as `TECHNICIAN` but their profile starts
  `PENDING` until admin approval (`ACTIVE` required to act as a technician).
- No OAuth, no MFA, no password reset flow.

## 4. AI provider — z-ai-web-dev-sdk

- Concrete implementation: `src/lib/ai/providers/zai-provider.ts` — the **only**
  file in the codebase that imports `z-ai-web-dev-sdk`.
- Capabilities implemented:
  - `interpretProblem` (LLM)
  - `generateHypotheses` (LLM)
  - `generateClarifyingQuestion` (LLM)
  - `analyzeImage` (VLM)
  - `explainTroubleshooting` (LLM)
  - `generateTechnicianBrief` (LLM)
  - `generateRepairSummary` (LLM)
  - `explainMatch` (LLM)
  - `converse` (LLM)
- All calls: bounded retry (1 retry on transient errors only), 30 s LLM / 45 s
  VLM timeout, JSON extraction with markdown-fence tolerance, Zod schema
  validation of parsed output, token usage capture (nullable when the SDK does
  not report it).
- Safety gate (`src/lib/ai/safety.ts`) is **deterministic and authoritative**:
  high-risk keywords escalate to `PROFESSIONAL_ONLY`; the AI can never downgrade
  a known `PROFESSIONAL_ONLY` cause.
- Curated error-code table (`src/lib/ai/error-codes.ts`): the AI may only cite
  meanings for codes in this table; unknown codes are reported as "unsupported."

## 5. Payment — MockPaymentProvider

- Concrete implementation: `src/lib/providers/payment.ts`.
- In-memory `Map<string, PaymentIntent>` — no real money, no real provider.
- Lifecycle: `createIntent` → `PENDING`; `capture` → `SUCCEEDED`; `refund` →
  `REFUNDED`.
- The canonical financial record is the `Payment` row in the DB. The provider
  only holds ephemeral intent state.
- UI surfaces label this clearly as sandbox/mock.
- **No webhook receiver exists.** No real provider (Stripe / Chapa) is wired.
- The provider interface (`createIntent` / `capture` / `refund`) is what a real
  Stripe/Chapa implementation would satisfy.

## 6. Storage — LocalStorageProvider

- Concrete implementation: `src/lib/providers/storage.ts`.
- Writes to `UPLOAD_DIR` (default `./uploads`); each file is renamed to a random
  UUID before being written to disk.
- Path traversal protection: `safeKey()` rejects any storage key that is not
  `[A-Za-z0-9-]+`.
- Files are **never** served directly from the filesystem. All access goes
  through authenticated API routes:
  - `GET /api/uploads/[id]` — problem media (owner / assigned tech / admin).
  - `GET /api/technician/documents/[id]` — verification documents (owning tech
    / admin only — explicit IDOR protection).
- No S3 / object storage adapter is implemented. No signed URLs.

## 7. Notification — database + socket.io

- Canonical record: `Notification` rows in the DB.
- Delivery: in-app bell + list (via `/api/notifications`).
- Realtime push: server-side `fetch("http://127.0.0.1:3003/emit", ...)` to the
  socket.io mini-service, which then emits to a per-user channel.
- Notification preferences (`NotificationPreference`) are honored — categories
  the user has disabled are not persisted.
- **No email delivery, no SMS, no push notifications.** `EMAIL_PROVIDER`
  defaults to `console` (no real provider implemented).

## 8. Rate limiting — in-memory sliding window

- AI rate limiter: `src/lib/ai/rate-limit.ts`.
  - 20 AI requests/min/user, 15/min/session, 5 image analyses/min/user, 10
    conversational turns/min/session.
- General rate limiter: `src/lib/rate-limit.ts`.
  - `login: 10`, `register: 5`, `booking: 10`, `dispute: 5`,
    `disputeMessage: 20`, `upload: 20`, `quote: 10`, `payment: 10` (all per
    minute).
- Mechanism: `Map<key, {count, windowStart}>` in process memory. State is lost
  on restart. **Not multi-instance safe** — if you run > 1 web process, each
  has its own counters and the effective limit is multiplied by the instance
  count. Swap target: Redis or Upstash.

## 9. Realtime — socket.io mini-service on `:3003`

- Implementation: `mini-services/realtime/index.ts` (Node HTTP + socket.io).
- Frontend connects via the Caddy gateway rule (`?XTransformPort=3003`) using
  `io("/", { query: { XTransformPort: "3003" } })`.
- Channel model: `channel = userId`. The client subscribes with its own userId.
- **Trust model:** the realtime layer is UX-only. It trusts the client-supplied
  userId for *subscription*, but the API layer is the real authorization
  boundary. Database is the source of truth.
- On reconnect, the client invalidates all React Query caches so the UI refetches
  authoritative state — recovering from any events missed while disconnected
  (`src/hooks/use-realtime.ts`).
- A tiny HTTP `/emit` endpoint on `:3003` lets the Next.js API push events
  without being a socket.io client itself.

## 10. Error model — categorized, application-wide

- `src/hooks/use-api.ts` defines `ApiError` with 10 categories:
  `UNAUTHENTICATED`, `UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`,
  `CONFLICT`, `INVALID_STATE`, `RATE_LIMITED`, `PROVIDER_ERROR`,
  `NETWORK_ERROR`, `INTERNAL_ERROR`.
- React Query retry logic skips non-retryable categories (auth/authz/validation/
  conflict/state).
- Human-readable copy per category is centralized in `ERROR_MESSAGES`.

## 11. Audit logging

- `src/services/audit-service.ts` writes `AuditLog` rows: `actorId`,
  `actorRole`, `action`, `entityType`, `entityId`, `metadataJson`.
- Best-effort: failures in audit logging never block the business operation.
- Surfaced to admins via `/api/admin/audit-log` and `/api/admin/analytics`.

## 12. Application-level production readiness validator

- `src/lib/env.ts` exports `validateProductionReadiness()` which checks:
  - `NEXTAUTH_SECRET` present (critical).
  - `DATABASE_URL` present (critical).
  - In production: `PAYMENT_PROVIDER != "mock"` (warning), `STORAGE_PROVIDER
    != "local"` (warning), `EMAIL_PROVIDER != "console"` (warning),
    `LOCATION_PROVIDER != "demo"` (info), and (if real payments) that
    `PAYMENT_WEBHOOK_SECRET` is set (critical).

## 13. Identified gaps (what this audit confirms is missing)

These are real gaps that the rest of `docs/` addresses honestly. None of them
are hidden; each is called out explicitly in the relevant doc.

1. **No PostgreSQL migrations.** The dev DB is SQLite, schema is managed with
   `prisma db push`, and there is no `prisma/migrations/` directory. See
   `docs/database-production.md`.
2. **No automated tests.** The runtime environment for development did not
   include a test runner; verification was done by lint, build, manual API
   inspection, and the agent browser. This is a documented constraint, not an
   oversight. See `docs/production-release-checklist.md`.
3. **No structured logging.** The codebase uses `console.log` / `console.error`
   in ad-hoc places. There is no JSON logger, no correlation IDs, no log-level
   plumbing. See `docs/logging.md`.
4. **No health-check endpoint.** `GET /api` returns a "Hello, world!" JSON. No
   `/api/health` exists. See `docs/deployment.md`.
5. **No payment webhooks.** The mock provider is called synchronously; there is
   no webhook receiver for real providers. See `docs/security.md` and
   `docs/deployment.md`.
6. **No real email delivery.** `EMAIL_PROVIDER=console` is the only working
   implementation. See `docs/production-release-checklist.md`.
7. **No Docker / CI.** There is no `Dockerfile`, no `docker-compose.yml`, no
   CI workflow file. See `docs/deployment.md`.
8. **No multi-instance safety.** In-memory rate limiters and the in-memory mock
   payment intent map are single-process only.
9. **No backup automation.** See `docs/disaster-recovery.md` (strategy only).
10. **No metrics / no Sentry / no APM.** `SENTRY_DSN` is read from env but never
    imported or wired. See `docs/observability` notes inside
    `docs/production-release-checklist.md`.

## 14. What already works well (do not regress)

- Server-side authorization on every sensitive route (`requireAuth`,
  `requireRole`, `requireCustomerProfile`, `requireTechnicianProfile`).
- Ownership checks (customer can only see own equipment/sessions/requests/
  bookings/payments/reviews/warranties/notifications; tech only sees own
  jobs/quotes/availability/documents).
- Zod validation on every mutating endpoint.
- No client-controlled financial values: quote total is server-derived from
  parts × qty + labor + inspection + taxes; refund amount is validated against
  the server-side paid amount.
- Duplicate prevention via DB unique constraints + explicit checks
  (`Booking.repairRequestId` unique, `Dispute.jobId` unique, warranty claim
  dedupe).
- Booking + repair job + appointment created atomically in a Prisma
  `$transaction`.
- AI safety gate is deterministic and authoritative (PROFESSIONAL_ONLY cannot
  be downgraded; high-risk keywords escalate).
- Path traversal protection on storage keys.
- Authenticated media downloads (no public file URLs).
- Audit log on registration, booking creation, dispute creation/resolution,
  technician verification, profile updates.
- Realtime reconnect invalidates caches (database is source of truth).
- Application-wide error model with categorized, human-readable messages.
- Booking availability + conflict detection prevents double-booking.

## 15. Numbers (verified)

- ~185 source files under `src/`.
- 73+ API route handlers under `src/app/api/**`.
- 25 feature screens under `src/features/**`.
- 55 Prisma models.
- 8 services under `src/services/**` (audit, AI, scheduling, diagnostic-engine,
  state-machines, matching-engine, notifications, ai-diagnostic-bridge).
- 2 rate limiters (AI + general).
- 1 mini-service (socket.io on `:3003`).
