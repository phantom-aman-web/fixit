import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { interpretProblem } from "@/services/ai-service";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { db } from "@/lib/db";

const schema = z.object({
  text: z.string().min(3).max(4000),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    // Rate limit.
    const rl = checkRateLimit(profile.userId, "interpret_problem", parsed.sessionId);
    if (!rl.allowed) {
      return ok({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, 429);
    }

    if (parsed.sessionId) {
      const s = await db.diagnosticSession.findUnique({ where: { id: parsed.sessionId } });
      if (!s || s.customerId !== profile.id) throw new HttpError(403, "Not your session");
    }

    const result = await interpretProblem(profile.id, parsed.text, parsed.sessionId);

    let isKnownDomain = false;
    if (result.interpretation?.equipment?.category) {
      const category = await db.equipmentCategory.findUnique({
        where: { slug: result.interpretation.equipment.category },
        include: { questions: { take: 1 } },
      });
      if (category && category.questions.length > 0) {
        isKnownDomain = true;
      }
    }

    return ok({
      interpretation: result.interpretation,
      safety: result.safety,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
      fallbackReason: result.fallbackReason,
      isKnownDomain,
    });
  } catch (e) {
    return apiError(e);
  }
}
