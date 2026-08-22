import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { startSessionFromInterpretation } from "@/services/ai-diagnostic-bridge";
import { checkRateLimit } from "@/lib/ai/rate-limit";

const schema = z.object({
  interpretation: z.object({
    equipment: z.object({
      category: z.string().nullable(),
      type: z.string().nullable().optional(),
      brand: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
    }).nullable().optional(),
    symptoms: z.array(z.string()),
    observations: z.array(z.string()),
    summary: z.string(),
    escalationRequired: z.boolean(),
  }),
  analysisId: z.string(), // Server-side safety reference
  equipmentId: z.string().optional(),
});

// POST /api/ai/start-session — start a diagnostic session from an AI
// interpretation, pre-filling any answers that can be mapped from the
// extracted symptoms. This is the critical bridge from AI → deterministic engine.
export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    // Rate limit.
    const rl = checkRateLimit(profile.userId, "start_session");
    if (!rl.allowed) {
      return ok({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, 429);
    }

    if (!parsed.interpretation.equipment?.category) {
      throw new HttpError(400, "Could not determine equipment category from interpretation");
    }

    const slug = parsed.interpretation.equipment.category;
    
    // Find the category + symptom, or create it dynamically (Universal Equipment support)
    let cat = await db.equipmentCategory.findUnique({
      where: { slug },
      include: { symptoms: true },
    });
    
    if (!cat) {
      const name = slug.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      cat = await db.equipmentCategory.create({
        data: {
          slug,
          name,
          symptoms: {
            create: {
              slug: 'general_issue',
              name: 'General Issue',
            }
          }
        },
        include: { symptoms: true },
      });
    }

    const symptom = cat.symptoms[0];
    if (!symptom) throw new HttpError(400, "No symptoms available for this category");

    // Create a problem report.
    const problem = await db.problemReport.create({
      data: {
        customerId: profile.id,
        categoryId: cat.id,
        equipmentId: parsed.equipmentId,
        description: parsed.interpretation.summary || "AI-assisted diagnosis",
        urgency: parsed.interpretation.escalationRequired ? "HIGH" : "NORMAL",
      },
    });

    // Start the session from the interpretation — this pre-fills answers.
    const result = await startSessionFromInterpretation({
      customerId: profile.id,
      categoryId: cat.id,
      symptomId: symptom.id,
      problemId: problem.id,
      equipmentId: parsed.equipmentId,
      interpretation: parsed.interpretation as any,
      analysisId: parsed.analysisId,
    });

    return ok({
      sessionId: result.sessionId,
      problemId: problem.id,
      preFilledAnswers: result.preFilledAnswers,
      state: result.state,
    }, 201);
  } catch (e) {
    return apiError(e);
  }
}
