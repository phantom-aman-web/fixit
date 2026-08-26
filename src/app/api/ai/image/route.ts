import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { analyzeImage } from "@/services/ai-service";
import { findErrorCode, type ErrorCodeLookupResult } from "@/services/error-code-service";
import { db } from "@/lib/db";
import { storage } from "@/lib/providers/storage";

const schema = z.object({
  sessionId: z.string(),
  mediaId: z.string().min(1),
  equipmentContext: z.string().optional(),
  problemContext: z.string().optional(),
});

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB for AI

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const rl = checkRateLimit(profile.userId, "analyze_image", parsed.sessionId);
    if (!rl.allowed) return ok({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, 429);

    const session = await db.diagnosticSession.findUnique({
      where: { id: parsed.sessionId },
      include: { problem: { include: { equipment: { include: { category: true } } } } },
    });
    if (!session || session.customerId !== profile.id) throw new HttpError(403, "Not your session");

    const category = await db.equipmentCategory.findUnique({ where: { id: session.categoryId } });

    const media = await db.problemMedia.findFirst({
      where: { url: parsed.mediaId, problemId: session.problemId ?? undefined },
    });
    if (!media) throw new HttpError(404, "Media not found");

    const file = await storage.read(parsed.mediaId);
    if (!file) throw new HttpError(404, "File not found on storage");

    if (file.buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new HttpError(413, `Image too large for AI analysis (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);
    }

    const dataUrl = `data:${file.mimeType};base64,${file.buffer.toString("base64")}`;

    const result = await analyzeImage(
      profile.id,
      parsed.sessionId,
      dataUrl,
      parsed.equipmentContext ?? "",
      parsed.problemContext ?? "",
      parsed.mediaId,
    );

    // Post-process: match any extracted error codes against verified knowledge.
    let errorCodeMatch: { code: string; verified: ErrorCodeLookupResult | null } | null = null;
    let extractedBrand: string | null = null;
    let extractedModel: string | null = null;

    if (result.analysis?.observations) {
      for (const obs of result.analysis.observations) {
        if (obs.extractedData?.errorCode) {
          const categorySlug = category?.slug ?? session.problem?.equipment?.category?.slug;
          const verified = await findErrorCode({
            categorySlug: categorySlug,
            brand: session.problem?.equipment?.brand,
            model: session.problem?.equipment?.model,
            code: obs.extractedData.errorCode,
          });
          errorCodeMatch = { code: obs.extractedData.errorCode, verified };
        }
        if (obs.extractedData?.brand) extractedBrand = obs.extractedData.brand;
        if (obs.extractedData?.modelNumber) extractedModel = obs.extractedData.modelNumber;
      }
    }

    // Persist extracted model info to the equipment record if available
    // and the session has linked equipment.
    if (extractedBrand || extractedModel) {
      const equipmentId = session.equipmentId ?? session.problem?.equipmentId;
      if (equipmentId) {
        const eq = await db.customerEquipment.findUnique({ where: { id: equipmentId } });
        if (eq) {
          await db.customerEquipment.update({
            where: { id: equipmentId },
            data: {
              brand: extractedBrand ?? eq.brand,
              model: extractedModel ?? eq.model,
            },
          });
        }
      }
    }

    return ok({
      analysis: result.analysis,
      safety: result.safety,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
      // Error code recognition result — verified or explicitly unsupported.
      errorCodeMatch: errorCodeMatch ? {
        code: errorCodeMatch.code,
        verified: errorCodeMatch.verified?.confidence === "VERIFIED" || errorCodeMatch.verified?.confidence === "PARTIAL",
        meaning: errorCodeMatch.verified?.data?.meaning ?? null,
        safetyLevel: errorCodeMatch.verified?.data?.riskLevel ?? null,
        recommendedAction: errorCodeMatch.verified?.data?.recommendedActions ?? "FixIt does not currently have verified information for this error code. Please consult your equipment manual or a professional technician.",
      } : null,
      // Extracted model info (persisted to equipment record).
      extractedModel: extractedBrand || extractedModel ? { brand: extractedBrand, model: extractedModel } : null,
    });
  } catch (e) {
    return apiError(e);
  }
}
