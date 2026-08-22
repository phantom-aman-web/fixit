# FixIt — Roadmap

Phase 1 (this build) delivers a complete, deterministic, AI-free FixIt product.
AI is explicitly deferred to Phase 9.

## Phase 0 — Discovery & architecture  ✅
- Inspect repo, identify stack, ask unresolved questions, lock decisions.
- Produce ARCHITECTURE.md, ROADMAP.md, DATABASE.md, CHANGELOG.md, README.md.

## Phase 1 — Foundation
- Full Prisma schema (FixIt domain) + `db:push`.
- NextAuth v4 Credentials + Prisma adapter; bcrypt; roles; seeded admin/demo.
- Provider abstractions: StorageProvider (Local), RealtimeProvider (socket.io),
  PaymentProvider (Mock), AIProvider (disabled), DatabaseProvider (Prisma).
- Repository + service layer skeletons.
- Hash router (Zustand + `location.hash`) + app shell (header/nav/sticky footer).
- Design tokens (status colors, safety levels, confidence).
- Seed data: equipment categories, symptoms, questions, options, rules, possible
  causes, troubleshooting steps, technicians, service areas, reviews.

## Phase 2 — Auth & landing
- Sign-in / sign-up UI (Credentials).
- Role-aware redirect (customer dashboard, technician workspace, admin).
- Protected application states (server-enforced).
- Landing page: "Fix the problem yourself — or find the right person to fix it."
  CTAs: Diagnose a Problem / Find a Technician.

## Phase 3 — Diagnostic engine (core)
- Guided problem intake (equipment → symptoms → progressive questions).
- Data-driven diagnostic engine: questions → answers → rules → possible causes
  → confidence → risk level.
- Persistent sessions (leave & resume).
- Diagnosis result view (most likely cause, why, confidence, risk).
- Safe troubleshooting execution with step-by-step instructions, safety levels,
  required tools, expected/failure results.
- Step result recording (solved / failed / skipped).
- Escalation logic (risk too high, repeated failure, dangerous symptoms).

## Phase 4 — Technician marketplace & matching
- MatchingEngine with explainable scoring
  (skill 40, equipment expertise 20, distance 15, availability 10, rating 10,
  price 5).
- Contextual marketplace (pre-filtered by diagnosis).
- Technician profile pages (specialties, expertise, service area, rating, jobs,
  reviews, response time, verification status, demo labels).
- "Why this technician?" explanation.
- Search & filters (specialty, equipment, availability, rating, price, distance,
  verified).

## Phase 5 — Repair workflow
- Repair request record (customer + problem + equipment + diagnosis + technician).
- Technician-side: accept/decline, submit quotes (items, labor, parts, fees,
  warranty terms, expiration).
- Customer-side: approve / reject / request clarification.
- Booking state machine: Requested → Accepted → Scheduled → Confirmed →
  Cancelled | Completed (enforced transitions).
- Repair job workflow: Scheduled → En Route → Arrived → Inspecting → Diagnosing
  → Quote Submitted → Awaiting Approval → Repairing → Completed
  (enforced transitions + status history).
- Realtime updates via socket.io mini-service (:3003).
- Technician records diagnosis, work performed, parts.

## Phase 6 — Operations
- Payments abstraction (Mock provider, clearly labeled sandbox).
- Reviews (rating + category ratings: quality, professionalism, communication,
  value). Only after completed service.
- Warranties (duration, start/end, covered work, status).
- Repair history (equipment → repairs → diagnosis → technician → parts → cost →
  warranty).
- Equipment garage (add equipment, brand/model/serial/photos/notes/maintenance).
- Notifications (extensible types, read/unread).

## Phase 7 — Admin
- Manage users, technicians (applications, activation).
- Manage equipment categories & diagnostic content (view/edit questions, rules,
  causes, troubleshooting steps).
- Inspect repair jobs, reviews, platform activity.
- Role-based access (ADMIN only).

## Phase 8 — QA / hardening
- Agent Browser end-to-end verification of the golden path.
- Lint + build verification.
- Responsive (mobile/tablet/desktop) review.
- Accessibility basics (keyboard, focus, contrast, ARIA).
- Fix all broken interactions, console/runtime errors.
- Update documentation to match implementation.

## Phase 9 — AI integration (future, NOT in this build)
- Select provider, implement `AIProvider`.
- Structured extraction from messy user input.
- Diagnostic assistance (candidate causes mapped against structured rules).
- Explanation generation.
- Safety/policy layer constrains AI output; deterministic engine still runs.
- Image analysis (optional).
- Monitor cost/latency; deterministic fallbacks.

## Definition of Done (Phase 1–8)
- Main customer journey works end-to-end.
- Diagnostic engine works from persisted data.
- Prisma/SQLite persistence works.
- Authentication + roles work, server-enforced.
- Technician matching works with explanations.
- Booking + repair status transitions are enforced.
- Reviews + warranties + history work.
- Key error/empty/loading states work.
- Responsive + accessible basics.
- No major feature is merely simulated.
- AI has NOT been integrated prematurely.
