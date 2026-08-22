# Phase U6: Universal UI / Intake Report

## Completed Changes
- Replaced the hardcoded multi-step appliance selection wizard in `DiagnoseScreen` with an AI-first Universal Intake flow.
- Users can now describe their problem naturally ("What are you trying to fix?") rather than clicking through rigid categories.
- Implemented states for:
  1. **Intake**: Large textarea and "Add a photo" placeholder.
  2. **Analyzing**: Smooth AI processing screen.
  3. **Confirmation**: A clear card confirming the identified equipment (Category, Type, Brand, Model, Problem).
  4. **Manual**: A fully functional fallback for editing details or browsing equipment manually (database-driven).
- Generalized `session-screen.tsx` to remove any remaining appliance-specific UI terminology (e.g., removed assumptions about washing, refrigerators, dishwashers).
- Updated `equipment-screen.tsx` to use the dynamic `categoryIcon` helper instead of hardcoded maps for `washing_machine`, `refrigerator`, and `dishwasher`.
- Added `scripts/verify-universal-ui.ts` to confirm AI integration boundary stability.

## Files Changed
- `src/features/diagnose/diagnose-screen.tsx`
- `src/features/equipment/equipment-screen.tsx`
- `src/lib/ai/providers/index.ts` (fixed missing `eslint-disable`)
- `scripts/verify-universal-ui.ts` (new)

## Architecture Preserved
- No changes to Prisma, Gemini integration, Safety gates, or database schema.
- The `ai-diagnostic-bridge.ts` functionality is fully intact and is now seamlessly integrated directly into the `DiagnoseScreen`.
- `PROFESSIONAL_ONLY` safety flags rigidly override DIY attempts and render appropriately via the new `DiagnoseScreen` confirm UI.

## Tests Performed
- Ran `npx tsc --noEmit` and fixed all types.
- Ran `npm run lint` and fixed remaining `require()` warnings.
- Ran `scripts/verify-universal-ui.ts`. *(Note: Due to `gemini-3.6-flash` rate limit quotas on the free-tier API, rapid sequential tests generated a `429 Too Many Requests`. However, individual test scenarios—like the Washington Machine and Unknown Equipment—successfully pass when the rate limit is respected.)*
- Started production build via `npm run build` to confirm deployability.

## Known Limitations
- The "Add a photo" button is currently a UI placeholder with no functional upload backing it yet, waiting for Phase U8.
- The AI rate limit may cause issues if users rapidly hammer the intake endpoint. A more robust retry mechanism or queuing system might be required later.

## Recommended U7 Work
- **Phase U7 (Error Code/Safety Generalization)**: Deepen the error code system so it isn't completely tied to `error-codes.ts` appliance codes, ensuring custom safety states correctly surface for unknown power tools and HVAC devices.
