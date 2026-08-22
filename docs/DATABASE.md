# FixIt — Database

> Phase 1 database: **SQLite via Prisma**. Schema is designed relationally so a
> future migration to PostgreSQL/Supabase is mechanical. SQLite does not support
> native enums, so enum-like fields are `String` with validation in the service
> layer (zod schemas in `src/types/`).

## Connection

- `DATABASE_URL` in `.env` → `file:./prisma/dev.db` (SQLite).
- Client: `src/lib/db.ts` (singleton PrismaClient).
- Push schema: `bun run db:push`.
- Seed: `bun run prisma/seed/index.ts` (or `bunx tsx prisma/seed/index.ts`).

## Aggregates & relationships

### Identity & auth
- `User` — email, passwordHash, role (CUSTOMER|TECHNICIAN|ADMIN), NextAuth fields.
- `Account`, `Session`, `VerificationToken` — NextAuth Prisma adapter.
- `CustomerProfile` — phone, city, subCity, lat/lng (1:1 with User where role=CUSTOMER).
- `TechnicianProfile` — displayName, bio, avatar, rating, completedJobs, rates,
  verified, status (1:1 with User where role=TECHNICIAN).
- `TechnicianSkill` — skill + equipmentCategory + proficiency (M:N on technician).
- `ServiceArea` — name (Bole, Kazanchis…), lat/lng, radiusKm.
- `ServiceAreaAssignment` — M:N technician ↔ service area.

### Equipment & problems
- `EquipmentCategory` — slug (washing_machine…), name, icon.
- `EquipmentModel` — brand + model under a category.
- `CustomerEquipment` — a customer's saved equipment instance.
- `ProblemReport` — description, urgency, status, media.
- `ProblemMedia` — uploaded photos/videos (StorageProvider reference).
- `MaintenanceRecord` — equipment maintenance log.

### Diagnostic engine (data-driven)
- `Symptom` — per category (e.g. loud_noise_during_spin).
- `DiagnosticQuestion` — text, inputType, order, required; linked to category +
  optional symptom.
- `DiagnosticOption` — choices for a question.
- `DiagnosticRule` — condition (questionKey + optionValue + operator) → consequence
  (causeId + weight, or escalate).
- `PossibleCause` — name, description, riskLevel, baseConfidence.
- `TroubleshootingStep` — instructions, difficulty, safetyLevel, tools, expected/
  failure result, order.

### Diagnostic sessions
- `DiagnosticSession` — customer + problem + equipment + category + symptom +
  status + answers(JSON) + possibleCauses(JSON) + recommendation + confidence +
  riskLevel + escalationRecommendation + timestamps.
- `DiagnosticAnswer` — normalized per-question answer.
- `Diagnosis` — ranked possible cause with confidence + reasoning.
- `DiagnosticStepResult` — troubleshooting step attempt outcome.

### Repair lifecycle
- `RepairRequest` — customer + problem + session + optional technician + status.
- `TechnicianMatch` — repairRequest × technician with score + rank + explanation.
- `Quote` + `QuoteItem` — estimate with items, totals, warranty, expiration, status.
- `Booking` — scheduledAt, location, status (state machine).
- `RepairJob` — status (state machine), diagnosis, workPerformed, timestamps.
- `RepairStatusHistory` — append-only status log.
- `RepairPart` — parts used in a job.
- `Payment` — amount, currency, status, provider, providerRef.
- `Review` — rating + category ratings; only after completed job.
- `Warranty` — duration, start/end, covered work, status.
- `Notification` — type, title, body, data, read.

## State machines (enforced in services)

### Booking
```
REQUESTED → ACCEPTED → SCHEDULED → CONFIRMED → COMPLETED
                                 ↘ CANCELLED
```

### RepairJob
```
SCHEDULED → EN_ROUTE → ARRIVED → INSPECTING → DIAGNOSING
        → QUOTE_SUBMITTED → AWAITING_APPROVAL → REPAIRING → COMPLETED
                                                          ↘ CANCELLED
```

### Quote
```
SUBMITTED → APPROVED | REJECTED | EXPIRED
```

### Payment
```
PENDING → SUCCEEDED | FAILED → REFUNDED
```

## Indexes
- `User.email` unique.
- `CustomerProfile.userId` unique.
- `TechnicianProfile.userId` unique.
- `DiagnosticSession.customerId`, `.status`.
- `RepairRequest.customerId`, `.technicianId`, `.status`.
- `Booking.customerId`, `.technicianId`, `.status`.
- `Notification.userId`, `.read`.
- Composite lookups via Prisma `@@index` where needed.

## Authorization (server-enforced; approximates future RLS)
- Customer rows scoped by `customerId === session.user.id`'s profile.
- Technician rows scoped by `technicianId === session.user.id`'s profile.
- Admin bypasses ownership but still goes through explicit service policies.
- No client-side check is trusted as the boundary.

## Seeding
`prisma/seed/` contains:
- `index.ts` — orchestrator.
- `equipment.ts` — categories + models.
- `diagnostics.ts` — symptoms, questions, options, rules, causes, troubleshooting
  steps (washing machine, refrigerator, dishwasher paths minimum).
- `technicians.ts` — demo technicians, skills, service areas (Addis Ababa).
- `reviews.ts` — sample reviews.
- `admin.ts` — seeded admin/demo customer/technician accounts.

All seed data is clearly synthetic. Demo credentials are documented in README and
shown on the sign-in page.
