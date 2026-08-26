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
          },
          questions: {
            create: [
              {
                key: 'issue_duration',
                text: 'When did this issue first start?',
                inputType: 'SINGLE_SELECT',
                order: 1,
                options: {
                  create: [
                    { label: 'Just now', value: 'just_now' },
                    { label: 'A few days ago', value: 'days_ago' },
                    { label: 'Weeks ago or more', value: 'weeks_ago' },
                  ]
                }
              },
              {
                key: 'power_status',
                text: 'Does the equipment turn on at all?',
                inputType: 'SINGLE_SELECT',
                order: 2,
                options: {
                  create: [
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                    { label: 'Sometimes', value: 'sometimes' },
                  ]
                }
              },
              {
                key: 'recent_changes',
                text: 'Were there any recent changes or incidents before this started (e.g. power surge, moved)?',
                inputType: 'SINGLE_SELECT',
                order: 3,
                options: {
                  create: [
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                    { label: 'Not sure', value: 'not_sure' },
                  ]
                }
              }
            ]
          }
        },
        include: { symptoms: true },
      });
    }

    // Try to find a symptom that matches the AI's extracted symptoms or description.
    let symptom: any = null;
    const aiSymptoms = parsed.interpretation.symptoms.map(s => s.toLowerCase());
    
    for (const s of cat.symptoms) {
      const sName = s.name.toLowerCase();
      const sSlug = s.slug.replace(/_/g, ' ').toLowerCase();
      if (aiSymptoms.some(ais => ais.includes(sName) || ais.includes(sSlug) || sName.includes(ais))) {
        symptom = s;
        break;
      }
    }

    // If no match, try to use general_issue. If it doesn't exist, create it.
    if (!symptom) {
      symptom = cat.symptoms.find(s => s.slug === 'general_issue');
      if (!symptom) {
        symptom = await db.symptom.create({
          data: {
            categoryId: cat.id,
            slug: 'general_issue',
            name: 'General Issue',
            description: 'General or unclassified issue.',
          }
        });
      }
    }

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
