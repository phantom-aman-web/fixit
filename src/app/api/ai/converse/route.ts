import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { converse } from "@/services/ai-service";
import { applyConversationAnswers } from "@/services/ai-diagnostic-bridge";
import { retrieveKnowledge, formatKnowledgeForPrompt } from "@/lib/ai/retrieval";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { db } from "@/lib/db";

const schema = z.object({
  sessionId: z.string(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const session = await db.diagnosticSession.findUnique({
      where: { id: parsed.sessionId },
      include: { answers: true, problem: true },
    });
    if (!session || session.customerId !== profile.id) throw new HttpError(403, "Not your session");

    // Rate limit.
    const rl = checkRateLimit(profile.userId, "converse", parsed.sessionId);
    if (!rl.allowed) {
      return ok({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, 429);
    }

    // Persist the user message.
    await db.aIInteraction.create({
      data: {
        sessionId: parsed.sessionId,
        role: "user",
        content: parsed.message,
      },
    });

    // Build conversation context from recent interactions.
    const recent = await db.aIInteraction.findMany({
      where: { sessionId: parsed.sessionId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const history = recent.reverse().map((m) => `${m.role}: ${m.content}`).join("\n");

    // Fetch the category name separately since it's not directly includable.
    const category = session ? await db.equipmentCategory.findUnique({ where: { id: session.categoryId } }) : null;

    const context = `Equipment: ${category?.name ?? "unknown"}
Symptom: ${session?.symptomSlug ?? "unknown"}
Problem: ${session?.problem?.description ?? "not specified"}
Answers so far: ${session?.answers.map((a) => `${a.questionText}=${JSON.parse(a.valuesJson).join(",")}`).join("; ") || "none"}

Conversation:
${history}`;

    const knowledge = await retrieveKnowledge(parsed.message);
    const knowledgeStr = formatKnowledgeForPrompt(knowledge);

    const result = await converse(profile.id, parsed.sessionId, context, knowledgeStr);

    // Persist the assistant response.
    if (result.response) {
      await db.aIInteraction.create({
        data: {
          sessionId: parsed.sessionId,
          analysisId: result.analysisId,
          role: "assistant",
          content: result.response.reply,
          structuredJson: result.response.extractedInfo ? JSON.stringify(result.response.extractedInfo) : null,
        },
      });

      // CRITICAL: Apply extracted answers to the deterministic diagnostic
      // session. This is the bridge from conversation → structured engine.
      // The AI's extracted answers become real DiagnosticAnswer rows that
      // the engine consumes to recompute possible causes.
      if (result.response.extractedInfo?.answers?.length) {
        try {
          const applied = await applyConversationAnswers(parsed.sessionId, result.response.extractedInfo);
          return ok({
            response: result.response,
            analysisId: result.analysisId,
            fellBack: result.fellBack,
            answersApplied: applied.applied,
            sessionState: applied.state,
          });
        } catch {
          // If applying answers fails, still return the conversation response.
        }
      }
    }

    return ok({
      response: result.response,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
      answersApplied: 0,
    });
  } catch (e) {
    return apiError(e);
  }
}
