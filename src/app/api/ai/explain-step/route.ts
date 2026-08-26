import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { explainTroubleshootingStep } from "@/services/ai-service";
import { db } from "@/lib/db";

const schema = z.object({
  sessionId: z.string(),
  stepId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const session = await db.diagnosticSession.findUnique({ where: { id: parsed.sessionId } });
    if (!session || session.customerId !== profile.id) throw new HttpError(403, "Not your session");

    const step = await db.troubleshootingStep.findUnique({ where: { id: parsed.stepId }, include: { cause: true } });
    if (!step) throw new HttpError(404, "Step not found");

    const result = await explainTroubleshootingStep(
      profile.id,
      parsed.sessionId,
      { title: step.title, description: step.description, instructions: step.instructions },
      step.cause?.name ?? "",
    );

    return ok({
      explanation: result.explanation,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
    });
  } catch (e) {
    return apiError(e);
  }
}
