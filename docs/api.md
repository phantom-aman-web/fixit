# FixIt — API Documentation

> FixIt's API is a Next.js 16 route-handler API mounted at `/api/**`. All
> sensitive routes enforce server-side authentication and authorization; a
> small number of public routes (equipment catalog, technician list, auth) are
> intentionally open.

## 1. Authentication

- **Mechanism:** NextAuth v4 Credentials + JWT sessions.
- **Endpoints:** `POST /api/auth/register`, `POST /api/auth/[...nextauth]`
  (sign in, sign out, getSession, getCsrfToken).
- **Session strategy:** stateless JWT. The session cookie is set by NextAuth;
  the JWT carries `id`, `email`, `name`, `role`. No per-request DB session
  lookup.
- **Password storage:** bcrypt with cost factor 10 (`bcryptjs`).
- **Roles:** `CUSTOMER`, `TECHNICIAN`, `ADMIN`.
  - New users default to `CUSTOMER`.
  - `TECHNICIAN` registrants start with their `TechnicianProfile.status = "PENDING"`
    and cannot act as technicians until an admin sets them to `ACTIVE`.
  - `ADMIN` accounts are seeded (see `prisma/seed/users.ts`).

### Server-side authorization helpers (`src/lib/api.ts`)

| Helper                       | What it guarantees                                             |
|------------------------------|----------------------------------------------------------------|
| `requireAuth()`              | Caller is authenticated. Throws 401 if not.                    |
| `requireRole(...roles)`      | Caller is authenticated and has one of the given roles.        |
| `requireCustomerProfile()`   | Caller is `CUSTOMER` (or `ADMIN`) and has a `CustomerProfile`. |
| `requireTechnicianProfile()` | Caller is `TECHNICIAN` (or `ADMIN`) and their profile is `ACTIVE`. |

The UI also checks roles for display purposes, but **client-side checks are
never the authorization boundary**. Every sensitive route re-checks on the
server.

## 2. Standard response format

- **Success:** `200 OK` / `201 Created` with the JSON body `{ ...payload }`
  (no envelope). Helpers: `ok(data, status)` in `src/lib/api.ts`.
- **Error:** `4xx` / `5xx` with body `{ "error": "Human-readable message" }`
  and, for rate-limited responses, `{ "error": "...", "retryAfterMs": <ms> }`.
  Helper: `apiError(err)` in `src/lib/api.ts`.
- **Empty success:** `204 No Content` with no body (rare; used by some
  mutation endpoints that return only metadata via React Query cache
  invalidation).

## 3. Error categories

The application-wide error model (`src/hooks/use-api.ts`) classifies every
error into one of 10 categories. The HTTP status is the wire-level signal;
the category is the application-level signal the UI switches on.

| Category           | HTTP status   | Meaning                                                            | Retryable? |
|--------------------|---------------|--------------------------------------------------------------------|------------|
| `UNAUTHENTICATED`  | 401           | No session or session expired.                                     | No         |
| `UNAUTHORIZED`     | 403           | Authenticated but not permitted (wrong role or not the owner).     | No         |
| `VALIDATION_ERROR` | 422 (or 400) | Request body failed Zod validation.                                | No         |
| `NOT_FOUND`        | 404           | Resource does not exist or caller has no right to know it exists.  | No         |
| `CONFLICT`         | 409           | Unique constraint violation, duplicate, or version conflict.       | No         |
| `INVALID_STATE`    | 400           | Action not permitted in the current state-machine state.           | No         |
| `RATE_LIMITED`     | 429           | Too many requests. `retryAfterMs` included.                        | After delay |
| `PROVIDER_ERROR`   | 502 / 503 / 5xx | An external provider (AI, payment, storage) failed.              | Yes        |
| `NETWORK_ERROR`    | 0 (no response) | Could not reach the server at all.                               | Yes        |
| `INTERNAL_ERROR`   | 500           | Anything else. The detailed message is logged server-side; the    | Yes        |
|                    |               | client receives a generic "Internal server error".                 |            |

React Query retry logic skips non-retryable categories. Mutations get 1 retry
on transient failures; queries get up to 2 retries.

## 4. Rate limits

### AI endpoints (`src/lib/ai/rate-limit.ts`)

| Bucket                | Limit | Window |
|-----------------------|-------|--------|
| Per user (most AI)    | 20    | 60 s   |
| Per session (most AI) | 15    | 60 s   |
| Per user (image)      | 5     | 60 s   |
| Per session (converse) | 10   | 60 s   |

### General endpoints (`src/lib/rate-limit.ts`)

| Bucket            | Limit | Window | Applied to                              |
|-------------------|-------|--------|-----------------------------------------|
| `login`           | 10    | 60 s   | (Planned for login; currently enforced via NextAuth) |
| `register`        | 5     | 60 s   | `POST /api/auth/register` (per IP)      |
| `booking`         | 10    | 60 s   | `POST /api/bookings`                    |
| `dispute`         | 5     | 60 s   | `POST /api/disputes`                    |
| `disputeMessage`  | 20    | 60 s   | `POST /api/disputes/[id]/messages`      |
| `upload`          | 20    | 60 s   | Media + document uploads                |
| `quote`           | 10    | 60 s   | `POST /api/quotes`                      |
| `payment`         | 10    | 60 s   | `POST /api/payments/[id]/capture`       |

Rate-limited responses return `429` with `{ "error": "...", "retryAfterMs":
<ms> }`. The in-memory limiter is single-process — see
`docs/phase-5-baseline-audit.md` §13 for the multi-instance caveat.

## 5. Idempotency

- **Dispute resolution** is idempotent: a dispute already in `RESOLVED` or
  `REJECTED` rejects further resolution attempts with `400 "Dispute is already
  <status>"`.
- **Payment capture** is idempotent: a payment not in `PENDING` rejects
  re-capture with `400 "Payment is already <status>"`.
- **Refunds** are idempotent: refund requires `pay.status === "SUCCEEDED"`;
  once refunded, status moves to `REFUNDED` and a second refund attempt is
  blocked.
- **Booking creation** prevents duplicates via `Booking.repairRequestId @unique`.
- **Dispute creation** prevents duplicates via `Dispute.jobId @unique`.
- **Warranty claim creation** prevents duplicate open claims for the same
  warranty (checks for existing `OPEN` / `UNDER_REVIEW`).

> A general-purpose idempotency-key header for arbitrary POST endpoints is
> **not** implemented today. Endpoints that need it (payments, refunds) rely
> on state-machine gating instead.

## 6. Endpoint groups

All routes live under `src/app/api/**`. The list below is grouped by domain.

### Auth & users
| Method | Path                                | Auth         | Purpose                              |
|--------|-------------------------------------|--------------|--------------------------------------|
| POST   | `/api/auth/register`                | Public (RL)  | Register a CUSTOMER or TECHNICIAN.   |
| *      | `/api/auth/[...nextauth]`           | Public       | NextAuth sign in / out / session.    |
| GET    | `/api/customer/profile`             | Customer     | Get own customer profile.            |
| GET    | `/api/technician/verification`      | Technician   | Get own tech profile + documents.    |
| PATCH  | `/api/technician/verification`      | Technician   | Update own tech profile.             |

### Equipment & catalog
| Method | Path                                | Auth   | Purpose                              |
|--------|-------------------------------------|--------|--------------------------------------|
| GET    | `/api/equipment-categories`         | Public | List categories + symptoms + models. |
| GET    | `/api/customer/equipment`           | Customer | List own saved equipment.          |
| POST   | `/api/customer/equipment`           | Customer | Add equipment.                     |
| GET    | `/api/customer/equipment/[id]`      | Customer | Get / PATCH / DELETE own equipment. |
| PATCH  | `/api/customer/equipment/[id]`      | Customer |                                      |
| DELETE | `/api/customer/equipment/[id]`      | Customer |                                      |

### Marketplace
| Method | Path                                | Auth   | Purpose                              |
|--------|-------------------------------------|--------|--------------------------------------|
| GET    | `/api/technicians`                  | Public | List/filter ACTIVE technicians.      |
| GET    | `/api/technicians/[id]`             | Public | Technician profile detail.           |
| GET    | `/api/favorites`                    | Customer | List favorites.                    |
| POST   | `/api/favorites`                    | Customer | Add favorite.                      |
| DELETE | `/api/favorites/[technicianId]`     | Customer | Remove favorite.                   |

### Diagnostic engine (deterministic)
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| POST   | `/api/problems`                               | Customer | Create a problem report.         |
| POST   | `/api/problems/[id]/media`                    | Customer | Upload media (MIME + size checked). |
| GET    | `/api/diagnostic-sessions`                    | Customer | List own sessions.               |
| POST   | `/api/diagnostic-sessions`                    | Customer | Start a session.                 |
| GET    | `/api/diagnostic-sessions/[id]`               | Customer | Get session state.               |
| POST   | `/api/diagnostic-sessions/[id]/step`          | Customer | Advance to next question.        |
| POST   | `/api/diagnostic-sessions/[id]/answer`        | Customer | Submit an answer.                |
| POST   | `/api/diagnostic-sessions/[id]/complete`      | Customer | Finalize a session.              |

### AI (Phase 2) — all under `/api/ai/**`, all rate-limited
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| POST   | `/api/ai/interpret`                           | Customer | Interpret problem text.          |
| POST   | `/api/ai/start-session`                       | Customer | Bridge AI → deterministic engine. |
| POST   | `/api/ai/hypotheses`                          | Customer | Generate ranked hypotheses.      |
| POST   | `/api/ai/clarify`                             | Customer | Generate a clarifying question.   |
| POST   | `/api/ai/explain-step`                        | Customer | Explain a troubleshooting step.  |
| POST   | `/api/ai/image`                               | Customer | Analyze an image (VLM).          |
| POST   | `/api/ai/technician-brief`                    | Tech     | Generate a technician brief.     |
| POST   | `/api/ai/repair-summary`                      | Tech     | Generate a repair summary.       |
| POST   | `/api/ai/match-explain`                       | Customer | Explain a technician match.      |
| POST   | `/api/ai/converse`                            | Customer | Conversational turn.             |
| GET    | `/api/ai/conversation/[sessionId]`            | Customer | Get conversation history.        |
| POST   | `/api/ai/start-session`                       | Customer | Start session from interpretation. |
| GET    | `/api/ai/admin/stats`                         | Admin    | AI usage stats.                  |

### Repair requests, quotes, bookings
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| GET    | `/api/repair-requests`                        | Customer | List own requests.               |
| POST   | `/api/repair-requests`                        | Customer | Create + compute matches.        |
| GET    | `/api/repair-requests/[id]/match`             | Customer | Get matches for a request.       |
| POST   | `/api/repair-requests/[id]/select`            | Customer | Select a technician.             |
| POST   | `/api/quotes`                                 | Tech     | Submit a quote (server-derived total). |
| POST   | `/api/quotes/[id]/decision`                   | Customer | Approve / reject a quote.        |
| GET    | `/api/bookings`                               | Customer | List own bookings.               |
| POST   | `/api/bookings`                               | Customer | Create booking + job + appointment (transactional). |
| POST   | `/api/bookings/[id]/transition`               | Tech/Cust| Transition booking state.        |
| POST   | `/api/bookings/[id]/payment`                  | Customer | Create a payment intent.         |

### Repair workflow
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| GET    | `/api/technician/jobs`                        | Tech     | List own jobs.                   |
| GET    | `/api/technician/requests`                    | Tech     | List incoming requests.          |
| GET    | `/api/technician/dashboard`                   | Tech     | Today + earnings + active jobs.  |
| POST   | `/api/repair-jobs/[id]/transition`            | Tech     | Transition repair job state.     |
| POST   | `/api/repair-jobs/[id]/diagnosis`             | Tech     | Update diagnosis on the job.     |
| POST   | `/api/repair-jobs/[id]/parts`                 | Tech     | Add parts used.                  |
| GET    | `/api/inspections/[jobId]`                    | Tech     | Get inspection.                  |
| POST   | `/api/inspections/[jobId]`                    | Tech     | Save inspection.                 |
| GET    | `/api/location/[jobId]`                       | Tech/Cust| Get tech location (demo-mode).   |
| POST   | `/api/location/[jobId]`                       | Tech     | Update own location.             |
| GET    | `/api/appointments/[id]/reschedule`           | Tech/Cust| Get reschedule history.          |
| POST   | `/api/appointments/[id]/reschedule`           | Tech/Cust| Reschedule (conflict-checked).   |

### Technician availability & documents
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| GET    | `/api/technician/availability`                | Tech     | List own slots.                  |
| POST   | `/api/technician/availability`                | Tech     | Add slot / block.                |
| DELETE | `/api/technician/availability/[id]`           | Tech     | Delete slot.                     |
| GET    | `/api/technician/slots/[date]`                | Public   | Available slots for a date.      |
| GET    | `/api/technician/documents`                   | Tech     | List own verification documents. |
| POST   | `/api/technician/documents`                   | Tech     | Upload verification document.    |
| GET    | `/api/technician/documents/[id]`              | Tech/Admin | Download (IDOR-protected).     |
| GET    | `/api/technician/earnings`                    | Tech     | Server-derived earnings summary. |

### Payments, reviews, warranties
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| POST   | `/api/payments/[id]/capture`                  | Customer/Admin | Capture a pending payment. |
| GET    | `/api/reviews/[jobId]`                        | Customer | Get review for a job.            |
| POST   | `/api/reviews/[jobId]`                        | Customer | Submit review (post-completion). |
| GET    | `/api/warranties`                             | Customer | List own warranties.             |
| GET    | `/api/warranty-claims`                        | Customer | List own claims.                 |
| POST   | `/api/warranty-claims`                        | Customer | File a claim (duplicate-checked). |
| POST   | `/api/warranty-claims/[id]/resolve`           | Admin    | Resolve / reject claim.          |

### Disputes
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| GET    | `/api/disputes`                               | Any      | Customer/tech/admin see own/all. |
| POST   | `/api/disputes`                               | Customer | Open dispute (RL).               |
| POST   | `/api/disputes/[id]/messages`                 | Any party| Post a message (RL).             |
| POST   | `/api/disputes/[id]/resolve`                  | Admin    | Resolve (refund validated).      |

### Notifications
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| GET    | `/api/notifications`                          | Any      | List notifications.              |
| GET    | `/api/notifications/unread-count`             | Any      | Count unread (polled every 30 s). |
| POST   | `/api/notifications/[id]/read`                | Any      | Mark one read.                   |
| GET    | `/api/notification-preferences`               | Any      | Get preferences.                 |
| PATCH  | `/api/notification-preferences`               | Any      | Update preferences.              |

### Media
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| GET    | `/api/uploads/[id]`                           | Any (owner/assigned tech/admin) | Authenticated media download. |

### Dashboards
| Method | Path                                          | Auth     | Purpose                          |
|--------|-----------------------------------------------|----------|----------------------------------|
| GET    | `/api/customer/dashboard`                     | Customer | Prioritized dashboard data.      |
| GET    | `/api/technician/dashboard`                   | Tech     | Today + earnings + active work.  |
| GET    | `/api/admin/stats`                            | Admin    | Platform stats.                  |
| GET    | `/api/admin/analytics`                        | Admin    | Platform + AI + audit analytics. |
| GET    | `/api/admin/audit-log`                        | Admin    | Filterable audit log.            |
| GET    | `/api/admin/diagnostics`                      | Admin    | Diagnostic session audit.        |
| GET    | `/api/admin/verification`                     | Admin    | Pending documents + techs.       |
| PATCH  | `/api/admin/verification`                     | Admin    | Approve / reject (audit-logged). |
| GET    | `/api/admin/technicians`                      | Admin    | List all technicians.            |
| PATCH  | `/api/admin/technicians/[id]`                 | Admin    | Update technician (audit-logged). |

## 7. Public routes (intentionally unauthenticated)

These routes do not require a session:

- `GET /api/equipment-categories` — catalog browsing.
- `GET /api/technicians` — marketplace browsing (only `ACTIVE` techs returned).
- `GET /api/technicians/[id]` — technician profile detail.
- `GET /api/technician/slots/[date]` — available time slots for a date.
- `POST /api/auth/register` — registration (rate-limited per IP).
- `* /api/auth/[...nextauth]` — NextAuth endpoints.

All other routes require an authenticated session. Authorization (ownership
or role) is checked per route.

## 8. Request / response conventions

- All mutating requests use JSON bodies (`Content-Type: application/json`).
  File uploads accept base64-encoded payloads inside a JSON body (see
  `POST /api/problems/[id]/media`).
- All success responses are JSON. The body shape is endpoint-specific; there is
  no global envelope. Common top-level keys: `{ bookings }`, `{ quotes }`,
  `{ disputes }`, `{ notifications }`, `{ categories }`, `{ technicians }`,
  `{ request }`, `{ booking }`, `{ job }`, etc.
- Currency amounts are **integer minor units** (e.g. ETB cents). The `currency`
  field defaults to `"ETB"`. UI formatting uses `formatCurrency()`.
- Timestamps are ISO 8601 strings in UTC.
- IDs are CUIDs (Prisma default).

## 9. CORS

- Same-origin by default. The Next.js API does not set permissive CORS headers.
- The realtime mini-service (`:3003`) sets `Access-Control-Allow-Origin: *`
  because it is intended to be reached only via the Caddy gateway from the
  same browser origin. In production, scope this to the application origin.

## 10. Versioning

There is no URL version prefix (no `/api/v1/...`). The API is treated as an
internal contract between the Next.js frontend and the Next.js API routes. If
the API is exposed to third parties in the future, introduce `/api/v1/...` at
that point and treat the existing routes as the v1 surface.
