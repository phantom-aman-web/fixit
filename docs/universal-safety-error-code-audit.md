# Universal Safety & Error-Code Audit (Phase U7)

## 1. Hardcoded Error Codes
- `src/lib/ai/error-codes.ts`: Contains a curated, hardcoded list `VERIFIED_ERROR_CODES` representing LG and Samsung washing machines, LG refrigerators, and Bosch dishwashers.
- **Action**: Delete the hardcoded dictionary entirely. Replace all usages with a database-driven `ErrorCodeService`.

## 2. Appliance-Specific Error-Code Logic
- `src/lib/ai/error-codes.ts`: The logic explicitly checks against "washing_machine", "refrigerator", and "dishwasher".
- **Action**: Move all lookup logic to `src/services/error-code-service.ts` using the PostgreSQL `EquipmentErrorCode` model. 

## 3. AI-Generated Safety Decisions
- `src/lib/ai/safety.ts`: `gateProblemInterpretation` relies heavily on `interp.escalationRequired` from Gemini. `gateHypotheses` uses `safetyLevel` from Gemini but backs it by `knownCauseSafety` from the DB.
- **Action**: Centralize safety resolution in `src/services/safety-resolution.ts`. Gemini's output should be advisory. The final safety classification should depend on the strongest verified database constraint.

## 4. Client-Side Safety Decisions
- The frontend `DiagnoseScreen` reads the safety level returned by the server, but we must ensure that the API endpoint (`/api/ai/start-session` or similar) independently resolves safety rather than trusting a client-provided `riskLevel` payload.
- **Action**: Audit API handlers and ensure the final safety payload is generated purely server-side.

## 5. Database Safety Rules
- The existing Prisma schema has an `EquipmentErrorCode` model from Phase U2 with fields like `severity`, `riskLevel`, and `professionalRequired`.
- **Action**: Use these fields as the absolute source of truth for error-code safety. Ensure seed data populates these fields for a representative cross-domain dataset.

## 6. Existing EquipmentErrorCode Implementation
- The model `EquipmentErrorCode` exists in `prisma/schema.prisma` with `categoryId`, `brand`, `modelPattern`, `code`, `meaning`, `severity`, `riskLevel`, `possibleCauses`, `recommendedActions`, and `professionalRequired`.
- **Action**: Schema is sufficient. No major database changes needed unless we discover edge cases. 

## 7. Unknown Equipment Generic Troubleshooting
- Unknown equipment may receive unsafe generic troubleshooting if Gemini tries to "hallucinate" a fix.
- **Action**: Add explicit instructions/logic to classify unknown equipment with "UNKNOWN / LIMITED" safety confidence, providing only non-invasive guidance.

## 8. Gemini Overriding Deterministic Safety
- `src/lib/ai/safety.ts` contains basic gating, but Gemini could still mislabel an error code if it hallucinates a "SAFE" meaning for a code that is actually "PROFESSIONAL_ONLY" in the DB.
- **Action**: The new `safety-resolution.ts` must forcefully override any AI `SAFE` classification with the DB's `PROFESSIONAL_ONLY` or `CAUTION` state.
