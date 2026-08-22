# Universal Equipment Architecture Audit

This document is the result of a comprehensive audit of the FixIt codebase (Phase U1) to identify appliance-specific dependencies and define the architectural path forward to a universal platform.

## 1. Appliance-Specific Dependencies Found

The core database schema is remarkably generic, but the application layer has several hardcoded appliance assumptions:

### AI & Diagnostic Logic
- **`src/services/ai-diagnostic-bridge.ts`**: The `mapSymptomToAnswers()` function contains hardcoded `if (categoryId === "washing_machine")`, `refrigerator`, and `dishwasher` branches to map AI symptom text to specific deterministic question keys.
- **`src/lib/ai/error-codes.ts`**: The error code list is a hardcoded array limited entirely to LG/Samsung washing machines/refrigerators and Bosch dishwashers.
- **`src/lib/ai/prompts.ts` & `src/lib/ai/schemas.ts`**: Zod schemas like `ProblemInterpretationSchema` use appliance-specific examples in their descriptions, anchoring the LLM to appliance contexts.

### UI & Presentation
- **`src/features/equipment/equipment-screen.tsx`**: The `CATEGORY_ICONS` constant hardcodes `washing_machine`, `refrigerator`, and `dishwasher`.
- **`src/features/diagnose/diagnose-screen.tsx`**: The `categoryIcon()` helper uses a massive hardcoded switch statement. The intake flow forces a "Pick a category" selection before allowing natural language input.

### Data
- **`prisma/seed/diagnostics.ts`**: The seed data explicitly populates only three appliance categories. The AI fallback for unknown equipment isn't fully integrated with the UI state.

---

## 2. Generalization Strategy

All of the above dependencies **must and will be generalized**.

### Existing Architecture to Reuse
- **Database Schema**: The `schema.prisma` definitions for `EquipmentCategory`, `Symptom`, `DiagnosticQuestion`, `DiagnosticRule`, `PossibleCause`, and `TroubleshootingStep` are already fully relational and generic. We **do not need destructive schema changes** to the diagnostic engine.
- **Gemini Provider**: The existing structured AI output integration (Zod validation) is robust and will be preserved.
- **Customer/Technician Workflows**: The job matching, quoting, and repair status history models are equipment-agnostic and will remain untouched.
- **Safety Engine**: The deterministic `riskLevel` enum (`SAFE`, `CAUTION`, `PROFESSIONAL_ONLY`) is structurally sound and will remain the absolute source of truth.

### Database Changes Required
- Generalize the seed process (`prisma/seed/`) to dynamically populate new categories (e.g., Power Tools, HVAC, Electronics, Plumbing) without changing application code.
- Migrate `error-codes.ts` from a hardcoded file into a generic JSON lookup or a new lightweight database model (`EquipmentErrorCode`) to support cross-domain error codes.

### AI Changes Required
- **Knowledge Retrieval (RAG)**: Create `src/services/knowledge-retrieval.ts`. When a user provides natural language input, the AI will first identify the generic `equipmentCategorySlug`. We will then query the database for that category's known symptoms, rules, and safety flags, and inject them into the Gemini prompt. This forces Gemini to reason using **FixIt's Verified Knowledge** instead of hallucinating.
- **Dynamic Bridge**: `ai-diagnostic-bridge.ts` will be rewritten to match AI-extracted symptoms against the retrieved dynamic options from the database, completely removing the `washing_machine` conditionals.
- **Universal Prompts**: Update `prompts.ts` to be universally aware and pass the retrieved knowledge context directly.

### UI Changes Required
- **Universal Intake**: Rewrite the beginning of `DiagnoseScreen`. Instead of "Pick a category -> Pick a symptom -> Describe", the flow will be: **"What are you trying to fix? [Describe problem]"** -> AI Equipment Identification -> RAG -> Diagnostic Session.
- **Dynamic Icons**: Remove hardcoded icon maps; map icons dynamically via category slugs or unified icon sets.

### Safety Changes Required
- The AI will output a suggested `escalationRequired` flag, but the final `safetyLevel` will ALWAYS fall back to the deterministic `PossibleCause.riskLevel` or `TroubleshootingStep.safetyLevel` retrieved from the database. 
- Ensure that if the AI encounters an unknown equipment type, it defaults to `CAUTION` and refuses to provide deep internal DIY repair steps.

### Test Requirements
- Create `scripts/verify-universal-equipment.ts` to assert that:
  - "Bosch drill smoking" triggers `power_tools`, `HIGH` safety, and professional escalation.
  - "Laptop shuts down" triggers `electronics` and safe troubleshooting.
  - "Samsung washer UE error" maintains regression compatibility with Phase 8.2.

---

## 3. Next Steps (Execution Plan)

With this audit complete, I propose moving forward with the following execution order:

1. **PHASE U2**: Scaffold the new database seed architecture (`categories/`, `diagnostics/`) and create the Universal Error Code lookup system.
2. **PHASE U3 & U4**: Build the RAG Knowledge Retrieval service and update the AI Prompts/Schemas.
3. **PHASE U5**: Rewrite `ai-diagnostic-bridge.ts` to use dynamic matching instead of hardcoded rules.
4. **PHASE U6**: Update the `DiagnoseScreen` UI to the Universal Problem Intake flow.
5. **PHASE U7**: Run comprehensive regression verification.
