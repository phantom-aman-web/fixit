# FixIt Phase 8 — Integration Baseline Report

This document establishes the exact integration state of the FixIt codebase before beginning the Phase 8 real-service integrations.

## 1. Active Database
- **Provider**: SQLite (`provider = "sqlite"` in `prisma/schema.prisma`)
- **Connection**: `DATABASE_URL=file:./custom.db` in `.env`
- **Migration Mechanism**: Currently relying on `db:push`. No `prisma/migrations/` history exists.
- **Readiness**: The schema is generically typed and ready for a smooth migration to PostgreSQL, but all JSON-like fields are currently stored as `String`. 

## 2. AI Integration Status
- **Why AI is Failing**: The application successfully attempts to call the AI provider, but the `z-ai-web-dev-sdk` throws the following error: `Configuration file not found or invalid. Please create .z-ai-config in your project, home directory, or /etc.`. Because FixIt handles this failure gracefully, it triggers the deterministic fallback, meaning users still get a response but no actual AI processing occurs.
- **Current Configured Provider**: `z-ai-web-dev-sdk` wrapped by `src/lib/ai/providers/zai-provider.ts`.
- **Safety**: The AI safety gates, keyword escalations, and deterministic bridges are robust, intact, and actively intercepting responses.

## 3. Provider Abstractions & Mocks
- **Payment Integration**: 
  - **Status**: DEVELOPMENT ONLY (Mock)
  - **Abstraction**: `PaymentProvider` interface exists.
  - **Implementations**: `MockPaymentProvider` (active) and `ProductionPaymentProvider` (stubbed, throws an error if invoked).
- **Storage Integration**:
  - **Status**: DEVELOPMENT ONLY (Local)
  - **Abstraction**: `StorageProvider` interface exists.
  - **Implementation**: `LocalStorageProvider` writes to the local filesystem (`uploads/`).
- **Email Integration**:
  - **Status**: NOT IMPLEMENTED
  - **Abstraction**: None. Currently falls back to `console.log` or is entirely missing from core transactional workflows.
- **Outbox / Async Events**:
  - **Status**: NOT IMPLEMENTED
  - **Abstraction**: `OutboxEvent` model exists in the database, but there is no processor or integration wiring it into transactions.
- **Realtime Integration**:
  - **Status**: IMPLEMENTED BUT NOT FULLY VERIFIED
  - **Implementation**: `socket.io` server exists in `.next/standalone/server.js`, but client connectivity and payload correctness under heavy load require verification.
- **Location / Maps**:
  - **Status**: DEVELOPMENT ONLY
  - **Implementation**: Mocked `isDemo: true` flag active on `TechnicianLocationPing`.

## 4. Environment Variables
- **Current Variables**: 
  - `DATABASE_URL` (SQLite)
  - `NEXTAUTH_SECRET` (Configured)
  - `NEXTAUTH_URL` (Configured)
- **Missing Variables**:
  - PostgreSQL `DATABASE_URL` / `DIRECT_URL`
  - Payment Provider API Keys (e.g. Stripe)
  - Cloud Storage API Keys (e.g. Supabase Storage)
  - Email Provider API Keys (e.g. Resend)
  - Real AI credentials (`.z-ai-config` or `OPENAI_API_KEY` if migrating)
  - Missing `.env.example` template.

## 5. Intact Hardening (Phases 5.1 / 6 / 7)
All previous structural and environmental fixes remain fully intact:
- `scripts/copy-standalone.js` and `start-dev.ps1` (Windows compatibility).
- Idempotency models (`IdempotencyKey`) and integrations (payment capture).
- Transactional safety in `payments/[id]/capture` and `disputes/[id]/resolve`.
- RBAC, IDOR protections, rate limiting, and security middleware headers.

## 6. Required Action / Blockers
Before executing Phase 8.1 (PostgreSQL) and 8.2 (AI), the following credentials and configuration choices must be provided by the project owner:

- **Database**: Target PostgreSQL URL.
- **AI**: Either a valid `.z-ai-config` payload, or explicit authorization to switch the abstraction to OpenAI/Anthropic (and the corresponding API Key).
- **Payments**: Choice of Stripe or Chapa and the Test Secret Key.
- **Email**: Choice of Resend or SendGrid and the API Key.
- **Storage**: Choice of Supabase Storage or AWS S3 and the API Keys.

**STATUS**: DISCOVERY COMPLETE. PENDING CREDENTIALS TO BEGIN PHASE 8.1.
