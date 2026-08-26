# FixIt Contextual Search Architecture Report (Revised)

## 1. Existing Architecture & The Problem
**Current Implementation:** 
The application currently uses a single global search icon in the main navigation (`src/components/app/shell.tsx`). Clicking it opens a generic dialog that queries a monolithic endpoint (`/api/search/route.ts`). This endpoint performs three parallel database queries (Equipment, Technicians, Jobs) with a basic `contains` text match and returns a flat array of mixed results. 

**Flaws:** 
- It appears on every page (even Settings and Authentication).
- It returns limited results (`take: 3`).
- It uses naive string matching instead of relevance scoring.
- It lacks context (searching for a technician while on the equipment page yields confusing mixed results).

## 2. Search Strategy & Contexts

### 🟢 SEARCH REQUIRED & OPTIONAL (Implemented Contextually)
The search UI will appear intentionally in the page header, toolbar, or inline, depending on the context.

* **Messages (`/messages`)**
  * **Searchable Data:** Participant name, conversation relevance, recent message previews.
  * **Discovery Example:** "han" → Hanan Appliances, Hanan Appliances · Refrigerator Repair, recent conversation with Hanan.
* **Technicians Marketplace (`/technicians`)**
  * **Searchable Data:** Specialty/category relevance, technician name, skills, service area.
  * **Discovery Example:** "refrig" → Refrigerator specialists, technicians whose specialties match Refrigerator, relevant technician names.
* **Equipment (`/equipment`)**
  * **Searchable Data:** Equipment name/nickname, brand, model, category.
  * **Discovery Example:** "sams" → Samsung Refrigerator, Samsung Washing Machine.
* **Warranties (`/warranties`)**
  * **Searchable Data:** Equipment, brand/model, warranty provider, status.
* **Bookings (`/booking`) & History (`/history`) & Technician Jobs (`/technician/jobs`)**
  * **Searchable Data:** Technician/customer name, equipment, booking reference, status, date.
* **Diagnose (`/diagnose`)**
  * **Searchable Data:** Category and Symptom discovery.
  * **Implementation:** Contextual autocomplete *inside* the category selection step (e.g., "refrig" → Refrigerator, Commercial Refrigerator). Generic search bar is NOT added here.

### 🔴 SEARCH NOT NEEDED
The search trigger will be **completely hidden/absent** on these pages:
* Dashboard, Settings, Profile, Authentication, Landing page, Active Booking/Repair detail screens.

## 3. Shared Deterministic Ranking Engine

We will implement a shared deterministic ranking engine (`src/lib/search/ranking.ts`), but **each context will define its own ranking priorities**. Relevance must always dominate secondary metadata (like popularity).

**Core Scoring Sequence (in order of priority):**
1. **Exact Match**
2. **Prefix Match**
3. **Token / Word Boundary Match**
4. **Partial Match**
5. **Fuzzy Similarity / Levenshtein Distance**
6. **Optional Domain Aliases / Synonyms**

**Context-Specific Weighting Examples:**
- **Technicians:** Specialty/Category Relevance > Technician Name > Skills > Service Area > Rating/Popularity (tie-breaker only). A highly relevant washing-machine specialist must outrank a highly rated electrical technician.
- **Messages:** Participant Name > Conversation Relevance > Recent Message Relevance > Recency.
- **Equipment:** Name/Nickname > Brand > Model > Category.
- **Bookings/History:** Technician/Customer > Equipment > Booking Reference > Status > Date.

## 4. Typo Tolerance Strategy

We will not rely on a huge, hardcoded manual dictionary. Typo tolerance will systematically follow:
**Normalization → Tokenization → Exact Match → Prefix Match → Token Match → Partial Match → Fuzzy Similarity / Levenshtein.**
Aliases will be used sparingly for common domain-specific terms (e.g., "plumming" → "plumbing"), but the system will remain highly useful without them.

## 5. YouTube-Style Interaction Principles

The UI will not copy YouTube visually, but will adopt its core interaction principles:
- Instant suggestions while typing.
- Rich contextual information in results (not just plain names).
- Partial matching and typo tolerance.
- Recent/contextual suggestions where useful.
- Full keyboard navigation (Up/Down arrows, Enter to search, Escape to close).
- Clear button.
- Useful empty/loading/error states.

## 6. Performance & Rate Limiting

**Client-Side:**
- 200-300ms debounce on keystrokes.
- Cancel stale/in-flight requests.
- Heavy use of React Query caching to make suggestions feel instantaneous.

**Server-Side:**
- **Real API Rate Limiting** using the application's existing rate-limit infrastructure.
- Strict `Prisma.select` to avoid fetching entire database tables.
- Pagination and strict result limits.
- Maximum query length limits.
- Indexed fields where justified.

## 7. Security Model (Strict Authorization)

Search must NEVER become an IDOR bypass. Every server-side search endpoint will enforce the exact same authorization boundaries as the underlying resource:
- **Customers:** Can only search their own conversations, equipment, bookings, and history.
- **Technicians:** Can only search conversations, jobs, and bookings they are authorized to access.
- Authentication and Role-Based Access Control (RBAC) will strictly guard the APIs, even if the frontend is bypassed.

## 8. Implementation Sequence

Phase 1 (Audit) is complete. Phase 2 (Implementation) will strictly follow this order:

1. Shared normalization/search ranking utilities (`src/lib/search`)
2. Shared contextual search UI (`src/components/search`)
3. Remove global navbar search
4. Messages search
5. Technician search
6. Equipment search
7. Warranty search
8. Booking/history search
9. Technician job search where appropriate
10. Diagnosis contextual category search
11. Security/rate limiting
12. Performance optimization
13. Accessibility
14. Mobile UX
15. Regression testing

*Note: No LLM, AI, Elasticsearch, Algolia, or Vector Database infrastructure will be introduced. The architecture will rely entirely on a fast, deterministic, maintainable search engine leveraging our existing Postgres database and client/server-side TypeScript logic.*
