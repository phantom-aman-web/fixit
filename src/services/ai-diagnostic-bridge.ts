// AI-to-deterministic integration. This module bridges the AI interpretation
// into the existing DiagnosticSession, so the AI's understanding actually
// feeds the deterministic engine rather than being a disconnected chat.
//
// Flow:
//   AI interpretation (extracted symptoms, clarifying question answers)
//   → map to known diagnostic question keys
//   → call answerQuestion() for each
//   → deterministic engine recomputes possible causes
//   → session starts with AI-derived evidence

import { db } from "@/lib/db";
import { answerQuestion, startSession, getSessionState } from "@/services/diagnostic-engine";
import type { ProblemInterpretation, ConversationResponse } from "@/lib/ai/schemas";

// Start a diagnostic session from an AI interpretation, pre-filling any
// answers that can be mapped from the extracted symptoms.
export async function startSessionFromInterpretation(params: {
  customerId: string;
  categoryId: string;
  symptomId: string;
  problemId?: string;
  equipmentId?: string;
  interpretation: ProblemInterpretation;
  analysisId: string;
}): Promise<{ sessionId: string; preFilledAnswers: number; state: any }> {
  // Create the session using the existing deterministic engine.
  let state = await startSession({
    customerId: params.customerId,
    categoryId: params.categoryId,
    symptomId: params.symptomId,
    problemId: params.problemId,
    equipmentId: params.equipmentId,
  });

  const sessionId = state.session!.id;

  // Enforce Deterministic Safety from the original AI Analysis
  const analysis = await db.aIAnalysis.findUnique({ where: { id: params.analysisId } });
  if (!analysis || analysis.customerId !== params.customerId) {
    throw new Error("Invalid or unauthorized analysis reference");
  }

  // Parse the safety result securely from the backend record
  let riskLevel = "SAFE";
  if (analysis.safetyDecision === "ESCALATE") {
    riskLevel = "PROFESSIONAL_ONLY";
  } else if (analysis.rejectionReason?.includes("Caution")) {
    riskLevel = "CAUTION"; // The safety-resolution.ts sets reason based on CAUTION
  }
  // Wait, I should probably save `finalSafetyLevel` on aIAnalysis? 
  // Let me just parse it directly or update `DiagnosticSession`.

  // Update session with authoritative risk level
  await db.diagnosticSession.update({
    where: { id: sessionId },
    data: {
      riskLevel: riskLevel,
      status: riskLevel === "PROFESSIONAL_ONLY" ? "ESCALATED" : "IN_PROGRESS",
      escalationRecommendation: riskLevel === "PROFESSIONAL_ONLY" ? analysis.rejectionReason : null,
    }
  });

  // Load the session's questions so we can validate mappings.
  const [questions, category] = await Promise.all([
    db.diagnosticQuestion.findMany({
      where: { categoryId: params.categoryId },
      include: { options: true },
    }),
    db.equipmentCategory.findUnique({ where: { id: params.categoryId } }),
  ]);
  const categorySlug = category?.slug ?? "";

  const answeredKeys = new Set<string>();
  let preFilled = 0;

  if (params.interpretation.mappedAnswers && params.interpretation.mappedAnswers.length > 0) {
    for (const mapping of params.interpretation.mappedAnswers) {
      if (answeredKeys.has(mapping.questionKey)) continue;

      // Validate the question key exists for this category.
      const q = questions.find((q) => q.key === mapping.questionKey);
      if (!q) continue; // Database is source of truth

      // Validate every mapped value is a valid option.
      const validValues = mapping.values.filter((v) => q.options.some((o) => o.value === v));
      if (validValues.length === 0) continue;

      try {
        state = await answerQuestion(sessionId, mapping.questionKey, validValues);
        answeredKeys.add(mapping.questionKey);
        preFilled++;
      } catch {
        // If the engine rejects the answer, skip it — the user will answer in the guided flow.
      }
    }
  }

  return { sessionId, preFilledAnswers: preFilled, state: await getSessionState(sessionId) };
}

// Apply extracted answers from a conversation to the diagnostic session.
// Called after each conversational turn if the AI extracted structured answers.
export async function applyConversationAnswers(
  sessionId: string,
  extractedInfo: ConversationResponse["extractedInfo"],
): Promise<{ applied: number; state: any }> {
  if (!extractedInfo?.answers) return { applied: 0, state: await getSessionState(sessionId) };

  const session = await db.diagnosticSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found");

  const questions = await db.diagnosticQuestion.findMany({
    where: { categoryId: session.categoryId },
    include: { options: true },
  });

  let applied = 0;
  for (const ans of extractedInfo.answers) {
    if (!ans.questionKey) continue;
    // Validate the question key exists for this category.
    const q = questions.find((q) => q.key === ans.questionKey);
    if (!q) continue;
    // Validate each value is a known option.
    const validValues = ans.values.filter((v) => q.options.some((o) => o.value === v));
    if (validValues.length === 0) continue;
    try {
      await answerQuestion(sessionId, ans.questionKey, validValues);
      applied++;
    } catch {
      // Skip invalid answers.
    }
  }

  return { applied, state: await getSessionState(sessionId) };
}
