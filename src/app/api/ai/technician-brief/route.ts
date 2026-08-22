import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { generateTechnicianBrief } from "@/services/ai-service";
import { db } from "@/lib/db";

const schema = z.object({
  repairRequestId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = schema.parse(body);

    // Authorization: the assigned technician, the customer who owns the request, or admin.
    const rr = await db.repairRequest.findUnique({
      where: { id: parsed.repairRequestId },
      include: {
        problem: { include: { category: true, equipment: true, media: true } },
        session: { include: { diagnoses: { include: { cause: true } }, stepResults: { include: { step: true } }, answers: true } },
        customer: { include: { user: true } },
        technician: { include: { user: true } },
        quote: true,
      },
    });
    if (!rr) throw new HttpError(404, "Repair request not found");

    const isOwner = rr.customer.userId === user.id;
    const isTech = rr.technician?.userId === user.id;
    if (user.role !== "ADMIN" && !isOwner && !isTech) {
      throw new HttpError(403, "Not authorized");
    }

    // Build the diagnostic data string from actual persisted data.
    const diagData = JSON.stringify({
      customer: { name: rr.customer.user.name, subCity: (rr.customer as any).subCity },
      problem: { description: rr.problem.description, urgency: rr.problem.urgency, category: rr.problem.category.name },
      equipment: rr.problem.equipment ? { brand: rr.problem.equipment.brand, model: rr.problem.equipment.model } : null,
      session: rr.session ? {
        symptomSlug: rr.session.symptomSlug,
        answers: rr.session.answers.map((a) => ({ question: a.questionText, values: JSON.parse(a.valuesJson) })),
        diagnoses: rr.session.diagnoses.map((d) => ({ cause: d.cause.name, confidence: d.confidence, rank: d.rank })),
        stepsAttempted: rr.session.stepResults.map((s) => ({ step: s.step.title, status: s.status })),
      } : null,
      mediaCount: rr.problem.media.length,
      riskLevel: rr.session?.riskLevel,
    }, null, 2);

    const result = await generateTechnicianBrief(rr.customer.userId, diagData, rr.id);

    return ok({
      brief: result.brief,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
    });
  } catch (e) {
    return apiError(e);
  }
}
