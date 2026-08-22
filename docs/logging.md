# FixIt — Logging Policy

> FixIt's current logging is ad-hoc (`console.log` / `console.error` in a
> handful of places). This document defines the policy the codebase should
> adopt for production: structured JSON logs, request correlation IDs, clear
> log levels, and explicit rules on what may **never** be logged.

## 1. Current state (honest)

- `src/lib/api.ts` `apiError()`: `console.error("[api]", err)` on any
  unhandled exception.
- `src/services/notifications.ts` and `src/services/state-machines.ts`: silently
  swallow realtime push failures (intentional — realtime is best-effort).
- `mini-services/realtime/index.ts`: `console.log` for connection/disconnect
  events.
- `src/lib/env.ts`: reads `LOG_LEVEL` (default `info` in prod, `debug` in dev)
  but nothing consumes it yet.

There is **no structured logger** in the codebase today. The policy below is
the target the team should implement before launch.

## 2. Log format

### Development

- Human-readable, colored, single-line.
- Example: `[2025-01-15T13:45:01Z] INFO  POST /api/bookings 201 38ms userId=cx_abc`

### Production

- Structured JSON, one log per line, written to `stdout` (so the container
  runtime / journald / CloudWatch captures it).
- Fields:

```json
{
  "timestamp": "2025-01-15T13:45:01.123Z",
  "level": "info",
  "message": "POST /api/bookings",
  "requestId": "req_abc123",
  "userId": "user_xyz",
  "method": "POST",
  "path": "/api/bookings",
  "status": 201,
  "durationMs": 38,
  "category": "http",
  "tags": ["api", "booking"]
}
```

Standard fields:

| Field        | Type   | Required | Purpose                                       |
|--------------|--------|----------|-----------------------------------------------|
| `timestamp`  | string | Yes      | ISO 8601 UTC with milliseconds.               |
| `level`      | string | Yes      | `debug` / `info` / `warn` / `error`.          |
| `message`    | string | Yes      | Human-readable summary.                       |
| `requestId`  | string | When in request context | Correlation ID (see §5).        |
| `userId`     | string | When authenticated | The acting user's id.                |
| `category`   | string | Yes      | Domain (`http`, `auth`, `ai`, `payment`, `db`, `realtime`, `audit`). |
| `tags`       | array  | No       | Additional free-form tags for filtering.      |
| `error`      | object | When level=error | `{ name, message, stack, code }`.      |
| `metadata`   | object | No       | Structured context (ids, counts, durations).  |

## 3. Log levels

| Level   | When to use                                                       |
|---------|-------------------------------------------------------------------|
| `debug` | Verbose internals. Disabled in production unless investigating.   |
| `info`  | Normal operations (request served, job transitioned, payment captured). |
| `warn`  | Unexpected but recoverable (rate limit hit, AI retrying, provider degraded). |
| `error` | Failures requiring attention (500, payment provider down, DB error). |

`LOG_LEVEL` env var sets the minimum level emitted. Default:
- Development: `debug`.
- Production: `info`.

## 4. What to log

### API requests

For every API route handler:

- `info`: `METHOD /path status durationMs` (+ `userId` if authenticated).
- `warn`: any 4xx that is not a `NOT_FOUND` (could indicate misuse).
- `error`: any 5xx.

Implementation: a thin wrapper around `apiError()` / `ok()` in `src/lib/api.ts`
that emits the log line on response. (Not implemented today.)

### Authentication

- `info`: successful login (`{ userId, ip, userAgent }`).
- `warn`: failed login attempt (`{ email, ip, reason }`). Do NOT log the
  password (it never leaves the request body), but the email is acceptable for
  abuse investigation.
- `warn`: registration rate-limit hit (`{ ip }`).
- `info`: logout (`{ userId }`).

### State transitions

- `info`: every `Booking` / `RepairJob` state transition
  (`{ entityId, from, to, actorId }`).
- These mirror the audit log but are emitted in real time for ops dashboards.

### Payment actions

- `info`: payment intent created (`{ paymentId, bookingId, amount, currency }`).
- `info`: payment captured (`{ paymentId, providerRef }`).
- `warn`: payment capture failed (`{ paymentId, error }`).
- `info`: refund issued (`{ paymentId, refundAmount, disputeId }`).

### AI actions

- `info`: AI call initiated (`{ userId, requestType, sessionId? }`).
- `info`: AI call completed (`{ userId, requestType, latencyMs, status, tokensUsed? }`).
- `warn`: AI call failed validation (`{ requestType, error }`).
- `warn`: AI call timed out / retried (`{ requestType, attempt }`).
- `warn`: AI safety gate escalated or downgraded a hypothesis
  (`{ causeName, decision, finalSafetyLevel }`).

### Realtime

- `info`: client connected (`{ socketId }`) — already in the mini-service.
- `info`: client subscribed to a channel (`{ socketId, channel }`).
- `info`: server emit (`{ channel, event }`).
- `warn`: emit failed (`{ channel, event, error }`).

### Rate limiting

- `warn`: rate limit hit (`{ identifier, category, limit, retryAfterMs }`).
- `info`: not logged per-request when allowed (too noisy).

### Audit log writes

- Audit log entries are stored in the DB (`AuditLog` table). They do not need
  to also be in the application log — but a `debug` line is acceptable for
  local development.

### Database

- `error`: any Prisma error (`{ code, message }`).
- `debug`: slow queries (`{ durationMs, query }`) — only when `LOG_LEVEL=debug`.

## 5. Request correlation IDs

Every API request should be assigned a `requestId` (UUID v4) at the start of
the handler. The ID is:

- Logged with every log line emitted during the request.
- Returned in the `X-Request-ID` response header so users can quote it in
  support tickets.

Implementation sketch (not yet in the codebase):

```ts
// src/lib/api.ts
import { randomUUID } from "crypto";

export function requestIdHeader(): string {
  return randomUUID();
}

// In each route handler:
const requestId = randomUUID();
// ... pass requestId through the logger ...
return NextResponse.json(data, {
  headers: { "X-Request-ID": requestId },
});
```

A cleaner approach is a Next.js middleware that sets `req.headers["x-request-id"]`
if absent, and a small `withLogging(handler)` wrapper.

## 6. What NEVER to log

These are forbidden. Code review must reject any PR that introduces them.

| Never logged                                       | Why                                            |
|----------------------------------------------------|------------------------------------------------|
| Passwords (plain-text or hashed)                   | Passwords never leave the auth flow.           |
| NextAuth JWT session tokens                        | Token leakage = account takeover.              |
| `NEXTAUTH_SECRET`, API keys, webhook secrets       | Secrets must never appear in logs.             |
| Full payment card numbers, CVVs                    | PCI-DSS violation.                              |
| Payment provider API responses containing tokens   | May contain replay-able secrets.                |
| Full AI prompts (system + user)                    | May contain user PII; large; high volume.      |
| Full AI raw responses                              | May contain hallucinated PII; high volume.     |
| User passwords reset answers                       | (Reset flow not yet implemented; if added, never log.) |
| Technician verification document contents (image bytes, PDF streams) | PII. |
| Personal addresses (street-level)                  | Sub-city is fine; street-level address is PII. |
| Phone numbers in full                              | Mask: `+251*********12`.                       |
| Email addresses in production logs                 | Allowed in auth logs (for abuse investigation) but should be hashed in non-auth logs. |

The AI usage record (`AIUsageRecord`) deliberately stores only metadata
(`requestType`, `status`, `latencyMs`, `tokensUsed`, `provider`, `model`),
never raw prompts or responses. This is enforced in `src/lib/ai/usage.ts`.

## 7. Log routing

| Sink                | Source                  | Retention |
|---------------------|-------------------------|-----------|
| `stdout` (container) | App + realtime service  | Captured by container runtime. |
| CloudWatch / Loki / Datadog | `stdout` aggregation | 30 days hot, 1 year cold. |
| `AuditLog` table    | Application DB          | 12 months (see `docs/database-production.md`). |
| `AIUsageRecord` table | Application DB         | 90 days. |

Application logs and audit logs are **separate**. Audit logs are
domain-specific events (booking created, dispute resolved) stored in the DB
for admin dashboards. Application logs are operational (request served, error
thrown) shipped to the log aggregator.

## 8. Sensitive data masking

Implement a masking helper:

```ts
function mask(s: string, visible = 2): string {
  if (s.length <= visible) return "*".repeat(s.length);
  return "*".repeat(s.length - visible) + s.slice(-visible);
}

mask("+251912345678")   // "***********78"
mask("user@example.com") // "*************le" (or use a stricter scheme)
```

Use it for any PII that must be partially visible for correlation (e.g.
last-2-digits of phone for support).

## 9. Slow-query and error aggregation

- Aggregate Prisma errors by `error.code` (e.g. `P1001` = connection lost,
  `P2002` = unique constraint violation). Spike in any code = actionable
  signal.
- Aggregate API 5xx by route. Spike = actionable signal.
- Aggregate AI failures by `requestType` + `status`. Spike = actionable
  signal.

These aggregations are performed by the log aggregator (CloudWatch Insights,
Loki, Datadog) — not by the application.

## 10. Implementation roadmap

This is the order in which the team should implement the policy:

1. **Adopt a logger.** Add a small `src/lib/logger.ts` wrapper around
   `console` (dev) / JSON.stringify (prod) that supports the standard fields.
2. **Add `X-Request-ID` middleware.** Generate or pass through the ID on
   every request.
3. **Replace `console.error("[api]", err)`** in `apiError()` with a structured
   `logger.error({ requestId, err, path })`.
4. **Add request logging** to every API route (or via a `withLogging` wrapper).
5. **Add payment + AI + state-transition log lines** in the services.
6. **Wire Sentry** (or equivalent) using `SENTRY_DSN` from env. Capture
   unhandled exceptions and 5xx responses. (Read by `env.ts` but not yet
   used.)
7. **Document the log aggregator setup** (CloudWatch / Loki / Datadog) in a
   separate ops runbook.

## 11. What is NOT configured in the demo environment

- No structured logger. Ad-hoc `console.*` only.
- No request correlation IDs.
- No `X-Request-ID` header.
- No Sentry / APM integration.
- No log aggregator.

These are the production rollout tasks listed in
`docs/production-release-checklist.md`.
