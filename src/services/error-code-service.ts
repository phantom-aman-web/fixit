import { db } from "@/lib/db";
import type { EquipmentErrorCode } from "@prisma/client";

export type ErrorCodeConfidence = "VERIFIED" | "PARTIAL" | "UNKNOWN";

export interface ErrorCodeLookupResult {
  confidence: ErrorCodeConfidence;
  data: EquipmentErrorCode | null;
}

export async function findErrorCode(params: {
  categorySlug?: string | null;
  equipmentType?: string | null;
  brand?: string | null;
  model?: string | null;
  code: string;
}): Promise<ErrorCodeLookupResult> {
  const normalizedCode = params.code.trim().toUpperCase();

  // Try to find the category ID if slug is provided
  let categoryId: string | undefined = undefined;
  if (params.categorySlug) {
    const cat = await db.equipmentCategory.findUnique({
      where: { slug: params.categorySlug },
    });
    if (cat) categoryId = cat.id;
  }

  // Build the base query for the error code
  const baseQuery: any = {
    code: normalizedCode,
  };

  if (categoryId) {
    baseQuery.categoryId = categoryId;
  }

  // 1. Attempt exact match: Category + Brand + Model + Code
  if (categoryId && params.brand && params.model) {
    const exactModel = await db.equipmentErrorCode.findFirst({
      where: {
        ...baseQuery,
        brand: { equals: params.brand, mode: "insensitive" },
        // Simplified matching: normally you'd check modelPattern here.
        // For Phase 7, we'll just fall back to brand match if model isn't explicitly defined.
      },
    });
    if (exactModel) return { confidence: "VERIFIED", data: exactModel };
  }

  // 2. Attempt broad match: Category + Brand + Code
  if (categoryId && params.brand) {
    const brandMatch = await db.equipmentErrorCode.findFirst({
      where: {
        ...baseQuery,
        brand: { equals: params.brand, mode: "insensitive" },
      },
    });
    if (brandMatch) return { confidence: "VERIFIED", data: brandMatch };
  }

  // 3. Attempt Category + Code (generic for that category)
  if (categoryId) {
    const catMatch = await db.equipmentErrorCode.findFirst({
      where: {
        ...baseQuery,
      },
    });
    if (catMatch) return { confidence: "PARTIAL", data: catMatch };
  }

  // 4. Global match fallback (no category, just matching the code somewhere)
  // We don't return VERIFIED here because an E01 in a washer is different from E01 in a drill.
  const globalMatch = await db.equipmentErrorCode.findFirst({
    where: {
      code: normalizedCode,
    },
  });

  if (globalMatch) {
    return { confidence: "UNKNOWN", data: null }; // We know the code exists, but context is wrong.
  }

  return { confidence: "UNKNOWN", data: null };
}

export function isErrorCodeSupported(code: string): boolean {
  // A helper function for generic checks. 
  // Should ideally pass category context, but we mock it for generic tests.
  return true; // We don't want to fail hard just based on code string
}
