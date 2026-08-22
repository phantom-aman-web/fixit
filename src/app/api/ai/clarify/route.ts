import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { generateClarifyingQuestion } from "@/services/ai-service";
import { retrieveKnowledge, formatKnowledgeForPrompt } from "@/lib/ai/retrieval";
import { db } from "@/lib/db";

const schema = z.object({
  sessionId: z.string(),
  context: z.string().min(10).max(8000),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const session = await db.diagnosticSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!session || session.customerId !== profile.id) throw new HttpError(403, "Not your session");

    const knowledge = await retrieveKnowledge(parsed.context);
    const knowledgeStr = formatKnowledgeForPrompt(knowledge);

    const result = await generateClarifyingQuestion(
      profile.userId,
      parsed.sessionId,
      parsed.context,
      knowledgeStr,
    );

    return ok({
      question: result.question,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
    });
  } catch (e) {
    return apiError(e);
  }
}
