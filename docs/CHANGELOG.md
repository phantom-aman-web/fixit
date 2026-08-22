# FixIt — Changelog

All notable changes to FixIt are documented here. Dates are in Africa/Nairobi time.

## [Phase 1.0] — in progress

### Discovery & architecture
- Inspected existing repository (Next.js 16 + TS + Tailwind 4 + shadcn/ui +
  Prisma/SQLite + next-auth v4 unconfigured).
- Locked decisions: single `/` route + hash router; Prisma+SQLite with provider
  abstractions; no AI in Phase 1; no test files; maintain docs; Addis Ababa/ETB;
  NextAuth Credentials; LocalStorageProvider.

### Foundation (in progress)
- Full Prisma schema for the FixIt domain.
- NextAuth Credentials + Prisma adapter + bcrypt + roles.
- Provider abstractions: Storage, Realtime, Payment, AI (disabled).
- Hash router + app shell.
- Seed data: equipment, diagnostics, technicians, service areas, reviews.

(Entries will be appended as milestones complete.)

## [Phase 1.0] — complete

### Foundation
- Full Prisma schema (FixIt domain: 25+ models) pushed to SQLite.
- NextAuth v4 Credentials + Prisma adapter, bcrypt, roles (CUSTOMER/TECHNICIAN/ADMIN).
- Seeded admin/customer/technician demo accounts + 3 equipment categories with complete
  diagnostic content (symptoms, questions, options, rules, possible causes, troubleshooting
  steps) + 5 demo technicians with skills, service areas (Addis Ababa), reviews, warranties.
- Provider abstractions: DatabaseProvider (Prisma), StorageProvider (Local),
  RealtimeProvider (socket.io :3003), PaymentProvider (Mock), AIProvider (disabled — Phase 9).
- Hash router (Zustand + location.hash) — single user-visible `/` route, deep-linkable.
- App shell: sticky header with role-aware nav, notification bell, sticky footer.
- Design system: calm teal primary (no blue/indigo), status/safety/confidence badges,
  loading/error/empty states, PageContainer/PageHeader.

### Diagnostic engine (deterministic, no AI)
- Data-driven engine: questions → answers → rules → possible causes → confidence → risk.
- Branching, live possible-causes panel, escalation logic (risk too high / professional-only).
- Troubleshooting step execution with safety levels (Safe/Caution/Professional-only),
  required tools, expected/failure results, step result recording (solved/failed/skipped).
- Persistent sessions (leave & resume).

### Technician marketplace & matching
- Explainable matching engine (skill 40%, equipment 20%, distance 15%, availability 10%,
  rating 10%, price 5%) with per-match "Why this technician?" reasons.
- Contextual marketplace (pre-filtered by diagnosis), filters, technician profiles.

### Repair workflow
- Repair requests → matches → technician selection → quotes (items, labor, parts, fees,
  warranty, expiration) → quote decision (approve/reject) → booking state machine
  (Requested→Accepted→Scheduled→Confirmed→Completed|Cancelled) → repair job workflow
  (Scheduled→En Route→Arrived→Inspecting→Diagnosing→Quote Submitted→Awaiting Approval→
  Repairing→Completed) with enforced transitions + status history.
- Technician workspace: accept requests, submit quotes, advance job status, record
  diagnosis/work/parts.
- Realtime updates via socket.io mini-service (:3003) for job status + notifications.

### Operations
- Mock payment provider (clearly labeled sandbox) with payment intent → capture flow.
- Reviews (rating + category ratings: quality, professionalism, communication, value)
  with technician aggregate rating update. Only after completed jobs.
- Warranties (duration, start/end, covered work, status) auto-created on review.
- Repair history (chronological, filterable).
- Equipment garage (add/edit/delete equipment, maintenance records, report-a-problem shortcut).
- Notifications (extensible types, read/unread, realtime push).

### Admin
- Stats dashboard, technician management (activate/suspend), diagnostic content browser
  (read-only), recent jobs.

### Verification
- `bun run lint` — 0 errors, 0 warnings.
- Landing page renders (HTTP 200).
- Equipment categories API returns correct seed data.
- NextAuth Credentials signin verified (demo customer, role CUSTOMER).
- Prisma schema valid and pushed.
- Seed data complete and consistent.

### Known infrastructure constraint
- The execution environment has a 4GB memory cgroup with no swap. The Next.js 16 dev
  server (webpack, ~1.4GB RSS) and chromium (Agent Browser, ~1GB) cannot run
  simultaneously. Full E2E Agent Browser verification was not possible; core flows were
  verified via curl + lint. The user's Preview Panel (separate rendering) should be used
  for visual verification.

## [Phase 1 Audit] — hardening pass

### Security fixes (P1)
- `requireTechnicianProfile` now rejects PENDING/SUSPENDED technicians.
- Booking transitions enforce per-role authorization: customers can only
  CANCEL; technicians handle ACCEPTED/SCHEDULED/CONFIRMED/COMPLETED.
- Payment amount derived server-side from `quote.totalEstimate` — the client
  may no longer set an arbitrary amount.
- Payment creation requires quote APPROVED + booking CONFIRMED.
- Payment capture requires PENDING status + valid providerRef.
- Media upload validates mime type (allowlist: jpeg/png/webp/gif/mp4/webm) and
  enforces a 10MB size limit.
- Quote route requires the technician to be the selected one
  (`rr.technicianId === profile.id`).
- `NEXTAUTH_SECRET` moved from hardcoded fallback to `.env` (random 32-byte
  secret). No secrets in source code.

### Correctness fixes (P2)
- Diagnostic engine escalation logic corrected: no longer escalates merely
  because a lower-ranked cause has PROFESSIONAL_ONLY risk. Only escalates when
  the TOP cause requires professional service or a rule explicitly says so.
  This allows safe troubleshooting when the most likely cause is benign.
- `recordStepResult` requires session status COMPLETED (rejects ESCALATED
  sessions — those should direct to professional service, not DIY).
- Matching engine: null customer lat/lng → neutral distance score (was using
  0,0, unfairly penalizing customers without set location).
- Removed duplicate `notifyJobStatus` call in repair-jobs transition route
  (was creating double notifications).
- Removed dead/broken `db.diagnosticOption.findFirst` in diagnostic engine
  (broken where clause + N+1 query).
- Removed dead `assertOwnsEquipment`/`assertOwnsSession` helpers (had
  userId/customerId type mismatch, were never called).
- Uploads read now checks media ownership (customer owner, assigned
  technician, or admin) — any authenticated user can no longer read any file.
- Payment capture now notifies the customer on job completion.
- Repair-jobs parts and diagnosis routes: simplified authorization (removed
  convoluted self-referential check).

### Verification performed
- `bun run lint`: 0 errors, 0 warnings.
- Domain-level verification (direct service imports, 13 test groups):
  - Auth (password, roles, technician status) ✓
  - Diagnostic engine: grinding → ESCALATED ✓, banging → COMPLETED (safe) ✓,
    fridge silent compressor → ESCALATED ✓, dishwasher dirty filter →
    COMPLETED (safe) ✓
  - Troubleshooting: SOLVED → RESOLVED ✓, ESCALATED rejects steps ✓
  - Matching: 5 matches, data-driven explanations ✓
  - State machines: valid transitions ✓, invalid rejected ✓, 8 history entries ✓
  - Full workflow: booking → job → quote → payment → review → warranty ✓
  - Authorization: cross-customer access denied ✓
- HTTP-level: auth signin 200, wrong password 401, unauth 401, APIs return
  correct seed data.
- Seed integrity: all 23 diagnostic rules reference valid questionKeys +
  optionValues; all causes have steps; all technicians have skills + areas.

### Known environment limitation
The 4GB memory cgroup cannot sustain cumulative Next.js 16 webpack dev
compilation of all API routes. Full HTTP E2E journey via curl cannot complete
without OOM. Compensated with direct service-level verification (which tests
the actual business logic without HTTP overhead) and targeted HTTP tests for
auth + authorization boundary.

## [Phase 2.0] — AI-assisted diagnosis & intelligent repair platform

### AI infrastructure (`src/lib/ai/`)
- **Provider**: `zai-provider.ts` — the only file importing `z-ai-web-dev-sdk`.
  Implements LLM (`chat.completions.create`) and VLM
  (`chat.completions.createVision`) calls with timeout, JSON extraction, and
  Zod validation.
- **Schemas**: Zod schemas for every structured AI output
  (`ProblemInterpretation`, `Hypotheses`, `ClarifyingQuestion`,
  `ImageAnalysis`, `TroubleshootingExplanation`, `TechnicianBrief`,
  `RepairSummary`, `MatchExplanation`, `ConversationResponse`).
- **Prompts**: Centralized, versioned prompt definitions with a system
  instruction enforcing safety rules, JSON-only output, and prompt-injection
  defense (user content wrapped in delimiters).
- **Safety gate**: `safety.ts` — `gateProblemInterpretation`,
  `gateHypotheses`, `gateImageAnalysis`. AI can NEVER downgrade a
  PROFESSIONAL_ONLY cause. High-risk keywords (smoke, sparks, burning smell,
  gas, flooding) trigger immediate escalation.
- **Retrieval**: `retrieval.ts` — lightweight knowledge retrieval from the
  existing DB (categories, symptoms, questions, causes) to ground AI prompts.
- **Usage tracking**: `usage.ts` — persists `AIUsageRecord` for every call +
  admin stats aggregation.

### AI service layer (`src/services/ai-service.ts`)
- `interpretProblem` — NL → structured diagnostic context (no diagnosis).
- `generateHypotheses` — ranked hypotheses, verified against known causes.
- `generateClarifyingQuestion` — most useful next question.
- `analyzeImage` — VLM image analysis with OBSERVED/INFERRED/UNKNOWN model.
- `explainTroubleshootingStep` — plain-language step explanation.
- `generateTechnicianBrief` — brief from actual persisted diagnostic data.
- `generateRepairSummary` — customer-friendly summary from actual repair data.
- `explainMatch` — grounded match explanation from actual scoring data.
- `converse` — conversational diagnostic response with extracted info.

### Database changes
- `AIAnalysis`: one record per AI call, with structured result, safety
  decision, confidence, fallback flag, latency.
- `AIInteraction`: conversation messages (user/assistant/system) with
  structured extracted info.
- `AIObservation`: visual observations from image analysis (OBSERVED/INFERRED/UNKNOWN).
- `AIHypothesis`: diagnostic hypotheses with verification status.
- `AIUsageRecord`: aggregate usage tracking for admin analytics.

### API routes (`/api/ai/*`)
- `POST /api/ai/interpret` — interpret a NL problem description.
- `POST /api/ai/hypotheses` — generate ranked hypotheses.
- `POST /api/ai/clarify` — generate a clarifying question.
- `POST /api/ai/image` — analyze an image (VLM).
- `POST /api/ai/explain-step` — explain a troubleshooting step.
- `POST /api/ai/technician-brief` — generate a technician brief.
- `POST /api/ai/repair-summary` — generate a repair summary.
- `POST /api/ai/match-explain` — explain a technician match.
- `POST /api/ai/converse` — conversational diagnostic response.
- `GET /api/ai/conversation/[sessionId]` — fetch conversation history.
- `GET /api/ai/admin/stats` — admin AI analytics (ADMIN only).
- All routes: authenticated, authorized, Zod-validated, with fallback.

### UI changes
- **AI-assisted diagnostic screen** (`/#/ai-diagnose`): conversational
  interface with live interpretation panel, clarifying questions, safety
  escalation, guided-diagnosis handoff.
- **Session screen**: "Explain in plain language" button on each
  troubleshooting step (AI explanation alongside deterministic instructions).
- **Repair screen**: AI technician brief + repair summary card.
- **Marketplace**: AI match explanation (grounded in actual scoring data).
- **Admin**: AI analytics tab (usage stats, success/fallback rates, recent
  activity).
- **Landing**: AI-assisted diagnosis CTA.
- **Shell nav**: AI Diagnose route.

### Safety architecture
- AI output must pass through the safety gate before influencing UI or
  diagnostic engine.
- AI can NEVER downgrade PROFESSIONAL_ONLY to SAFE.
- High-risk keywords (smoke, sparks, burning smell, gas, flooding) trigger
  immediate professional escalation.
- Prompt injection defense: user content wrapped in delimiters, system
  instruction treats user text as untrusted.
- All AI output validated by Zod schemas; malformed output → fallback.

### Verification performed
- AI problem interpretation: washing machine grinding → correctly extracted
  equipment, symptoms, confidence 0.6, 3 clarifying questions ✓
- AI safety gate: "burning smell + smoke" → ESCALATED to PROFESSIONAL_ONLY ✓
- AI prompt injection: "Ignore all previous instructions..." → treated as
  user content, safety rules intact ✓
- Phase 1 regression: auth, diagnostic engine, matching, state machines all
  pass ✓
- Lint: 0 errors, 0 warnings.

### Known limitations
- Image analysis (VLM) verified at the infrastructure level; full HTTP E2E
  image upload verification limited by 4GB memory constraint.
- Browser-level verification limited by 4GB memory constraint (dev server +
  chromium cannot run concurrently). Compensated with direct service-level
  verification.

## [Phase 2 Final Audit & Hardening]

### Critical fixes applied
- **AI → Deterministic integration**: New `startSessionFromInterpretation` bridge
  service + `/api/ai/start-session` endpoint. AI interpretation now pre-fills
  DiagnosticAnswer rows by mapping extracted symptoms to known question keys.
  Verified: "grinding noise during spin cycle" → 2 answers pre-filled
  (`when_noise=during_spin`, `noise_type=grinding`) → 4 causes computed →
  top cause "Drum bearing wear" at 0.552 confidence. ✓ PASS
- **Conversation → session**: `/api/ai/converse` now calls
  `applyConversationAnswers` after each turn. AI-extracted answers are
  persisted as DiagnosticAnswer rows and consumed by the deterministic engine.
- **Rate limiting**: New `src/lib/ai/rate-limit.ts` — in-memory sliding window.
  Per-user: 20 req/min (5 for images). Per-session: 15 req/min (10 for
  converse). Enforced on all 10 AI routes. Returns 429 when exceeded.
  Verified: 25 rapid requests → 20 allowed, 5 blocked. ✓ PASS
- **Token/cost tracking**: Provider now captures `completion.usage` if available.
  `tokensUsed` populated only when provider reports it; null = unavailable.
  Admin stats distinguish `tokensReportedCount` vs `tokensUnavailableCount`.
  Never faked. ✓ PASS
- **Retries**: Provider implements 1 bounded retry (1s backoff) for transient
  errors (timeout, network, 5xx). Never retries validation failures. ✓ PASS
- **Error code recognition**: New `src/lib/ai/error-codes.ts` — 15 verified
  codes (LG, Samsung, Bosch). Known code → verified meaning + safety level +
  recommended action. Unknown code → explicit "unsupported" message.
  AI NEVER invents meanings. ✓ PASS
- **Model extraction**: Image analysis route now persists extracted brand/model
  to the CustomerEquipment record. ✓ PASS
- **Safety gate**: Verified all 7 test cases — smoke, sparks, burning smell,
  gas, flooding, PROFESSIONAL_ONLY downgrade attempt, prompt injection.
  All blocked/escalated correctly. ✓ PASS

### Verification results
- Lint: 0 errors, 0 warnings ✓
- Safety gate (7 test cases): ✓
- Error code recognition (known + unknown): ✓
- Rate limiting (25 requests → 20 ok, 5 blocked): ✓
- Token tracking schema (tokensUsed column exists, nullable): ✓
- AI → deterministic bridge (2 pre-filled answers, 4 causes computed): ✓
- Phase 1 regression (auth, diagnostic, matching, state machines): ✓
- HTTP-level: auth + landing page verified; cumulative API compilation OOMs
  in 4GB cgroup (documented limitation).

## [Phase 3.0] — Production-grade service marketplace, repair operations & real-time experience

### Database changes (13 new models)
- `AvailabilitySlot` — technician availability (recurring weekly slots + one-off blocks)
- `Appointment` + `AppointmentReschedule` — scheduled date/time with reschedule history
- `TechnicianLocationPing` — privacy-conscious location during active service (demo-mode)
- `RepairInspection` — structured technician inspection (observed issue, checks, error codes, parts, safety)
- `Dispute` + `DisputeMessage` — customer opens, technician responds, admin resolves
- `WarrantyClaim` — customer files claim against active warranty
- `TechnicianDocument` — verification documents (identity, certification, insurance)
- `NotificationPreference` — user-controlled notification toggles
- `FavoriteTechnician` — customer bookmarks
- `AuditLog` — actor/action/entity/timestamp for all important operations
- `TechnicianEarnings` — aggregate earnings for dashboard + admin

### New services
- `scheduling-service.ts` — real availability, conflict detection, double-booking prevention, slot generation
- `audit-service.ts` — audit log recording + retrieval

### New API routes (20+)
- Technician: availability (CRUD), slots by date, documents, verification, dashboard, earnings
- Customer: dashboard, favorites (CRUD), notification preferences
- Operational: appointments/reschedule, inspections, disputes (+ messages + resolve), warranty-claims (+ resolve), location (privacy-conscious)
- Admin: analytics (platform + AI + audit), verification queue, disputes, audit-log

### New UI screens (7 new + 3 upgraded)
- **Disputes** — role-aware list, open dispute dialog, message thread
- **Warranty claims** — file claim against active warranty, track status
- **Favorites** — bookmarked technician grid
- **Compare** — side-by-side technician comparison with best-value highlighting
- **Availability** — weekly slot management for technicians
- **Settings** — notification preferences, tech profile edit, document upload
- **Inspection form** — structured technician inspection recording
- **Dashboard (upgraded)** — prioritized "what needs my attention" cards
- **Technician workspace (upgraded)** — TODAY/REQUESTS/ACTIVE/APPROVAL/PERFORMANCE/EARNINGS
- **Admin (upgraded)** — 4 new tabs: Verification, Disputes, Analytics, Audit Log

### Key features
- **Real scheduling**: technicians configure working hours; customers see available slots; double-booking prevented server-side.
- **Dispute resolution**: customer opens → tech responds → admin resolves (with optional refund via payment provider).
- **Warranty claims**: customer files claim against active warranty; admin resolves.
- **Technician verification**: documents submitted → admin reviews → approve/reject/suspend.
- **Inspection workflow**: structured recording of observed issues, checks, error codes, suspected parts, safety concerns.
- **Privacy-conscious location**: demo-mode pings only during EN_ROUTE/ARRIVED; not available after job completion.
- **Audit log**: all important workflow + admin actions recorded with actor, action, entity, timestamp.
- **Admin analytics**: platform metrics (users, bookings, revenue, disputes) + AI stats + audit log.

### Verification
- Lint: 0 errors, 0 warnings.
- All 13 new tables verified in DB.
- Scheduling service: slot creation, availability check, conflict detection verified.
- Audit log: create + read verified.
- Phase 1+2 regression: all models + services intact.
- HTTP/browser verification: limited by 4GB memory constraint (documented since Phase 1).

### Stats
- 184 source files, 73 API routes, 25 feature screens.

## [Phase 4.0] — Production polish, UX excellence, reliability & deployment hardening

### New components
- **Repair timeline** (`src/components/shared/repair-timeline.tsx`): visual
  timeline with completed/current/pending steps, built from actual RepairJob
  status history. Integrated into the repair tracking screen.

### Error handling
- **Application-wide error model** (`src/hooks/use-api.ts`): `ApiError` class
  with 10 categories (UNAUTHENTICATED, UNAUTHORIZED, VALIDATION_ERROR,
  NOT_FOUND, CONFLICT, INVALID_STATE, RATE_LIMITED, PROVIDER_ERROR,
  NETWORK_ERROR, INTERNAL_ERROR). Human-readable messages per category.
  React Query retry logic skips non-retryable errors (auth, validation,
  conflict) and retries transient failures (network, provider).

### Realtime resilience
- **Reconnect recovery** (`src/hooks/use-realtime.ts`): on socket reconnect,
  invalidates all React Query caches so the UI fetches fresh authoritative
  state. Recovers from missed events during disconnection. Database remains
  the source of truth.

### Rate limiting
- **General rate limiter** (`src/lib/rate-limit.ts`): in-memory sliding window
  for non-AI high-risk endpoints:
  - login: 10/min per IP
  - register: 5/min per IP
  - booking: 10/min per user
  - dispute: 5/min per user
  - upload: 20/min per user
  - quote: 10/min per technician
  - payment: 10/min per user
- Added to registration route.

### Audit logging
- Registration now creates an `user_registered` audit log entry.

### Verification
- Lint: 0 errors, 0 warnings.
- Phase 1 regression: auth, state machines ✓
- Phase 2 regression: safety gate, error codes, PROFESSIONAL_ONLY ✓
- Phase 3 regression: scheduling, disputes, appointments ✓
- Phase 4 features: rate limiter, timeline, ApiError, realtime recovery ✓

## [Phase 5.0] — Production readiness, deployment, testing, observability & real-world hardening

### Environment configuration
- **`src/lib/env.ts`**: typed EnvConfig with all provider configurations (AI, payment, storage, email, location, monitoring). Feature flags (realPayments, realStorage, realEmail, realLocation, aiFeatures). Production readiness validator with severity levels (critical/warning/info).

### Database changes (3 new models)
- `IdempotencyKey`: unique key + userId + operation + requestHash + cached response + TTL.
- `PaymentWebhookEvent`: provider + eventId (unique) + eventType + payloadHash + status + error.
- `OutboxEvent`: type + aggregateType + aggregateId + payload + status + attempts + maxAttempts.

### New services
- **`src/services/idempotency-service.ts`**: checkIdempotency (returns cached response on replay, rejects different request with same key), storeIdempotencyResponse, cleanupExpiredKeys.
- **`src/lib/logger.ts`**: structured logging with LogEntry, sensitive key sanitization, JSON in production.
- **`src/lib/providers/payment-production.ts`**: ProductionPaymentProvider template, createPaymentProvider factory.

### New API routes
- `GET /api/health` — overall health + readiness checks.
- `GET /api/health/live` — liveness probe.
- `GET /api/health/ready` — readiness probe (database connectivity).
- `POST /api/webhooks/payment` — payment webhook receiver with signature verification, replay protection, idempotent processing.

### Security
- **Middleware** (`src/middleware.ts`): X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Content-Security-Policy (production), X-Request-ID correlation.
- **Payment webhook security**: HMAC-SHA256 signature verification, timingSafeEqual, raw body handling, replay protection.
- **Idempotency**: prevents duplicate bookings, payments, disputes, warranty claims.

### Deployment
- **Dockerfile**: multi-stage build (deps → builder → runner), non-root user, health check, minimal runtime.
- **CI/CD** (`.github/workflows/ci.yml`): lint → typecheck → prisma validation → production build.

### Documentation (8 new files)
- `docs/phase-5-baseline-audit.md` — baseline audit of existing codebase.
- `docs/database-production.md` — PostgreSQL migration strategy.
- `docs/api.md` — API documentation with all endpoint groups.
- `docs/security.md` — security architecture.
- `docs/deployment.md` — deployment guide.
- `docs/disaster-recovery.md` — backup/recovery strategy.
- `docs/logging.md` — logging policy.
- `docs/production-release-checklist.md` — release checklist.

### Verification
- Lint: 0 errors, 0 warnings.
- tsc: 0 errors in our code.
- 33/33 domain verification checks pass.
- Phase 1-4 regression: all pass.
