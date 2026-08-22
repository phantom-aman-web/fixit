// AI service — domain-level AI operations. This is the layer the API routes
// call. It orchestrates: knowledge retrieval → prompt construction → provider
// call → Zod validation → safety gate → persistence → usage tracking.
//
// If the AI fails at any step, the service returns a fallback result so the
// deterministic engine can continue. The user never sees a blank screen.

import { db } from "@/lib/db";
import { getAIProvider, type AIProviderCallResult } from "@/lib/ai/providers/index";
import {
  problemInterpretationPrompt,
  hypothesesPrompt,
  clarifyingQuestionPrompt,
  imageAnalysisPrompt,
  troubleshootingExplanationPrompt,
  technicianBriefPrompt,
  repairSummaryPrompt,
  matchExplanationPrompt,
  conversationPrompt,
} from "@/lib/ai/prompts";
import {
  retrieveKnowledge,
  formatKnowledgeForPrompt,
  retrieveCauseSafetyMap,
} from "@/lib/ai/retrieval";
import {
  gateHypotheses,
  gateImageAnalysis,
  sanitizeUserText,
  type SafetyGateResult,
} from "@/lib/ai/safety";
import { recordUsage } from "@/lib/ai/usage";
import type {
  ProblemInterpretation,
  Hypotheses,
  ClarifyingQuestion,
  ImageAnalysis,
  TroubleshootingExplanation,
  TechnicianBrief,
  RepairSummary,
  MatchExplanation,
  ConversationResponse,
} from "@/lib/ai/schemas";

// Persist an AI analysis record + usage record.
async function persistAnalysis(params: {
  sessionId?: string;
  customerId: string;
  requestType: string;
  result: AIProviderCallResult<any>;
  safety: SafetyGateResult;
  fellBack: boolean;
  fallbackReason?: string;
}) {
  const accepted = params.safety.decision !== "REJECTED" && !params.result.error;
  const analysis = await db.aIAnalysis.create({
    data: {
      sessionId: params.sessionId,
      customerId: params.customerId,
      requestType: params.requestType,
      provider: "gemini",
      model: params.result.model,
      resultJson: params.result.data ? JSON.stringify(params.result.data) : null,
      accepted,
      rejectionReason: params.safety.decision === "REJECTED" ? params.safety.reason : (params.result.error ?? null),
      safetyDecision: params.safety.decision,
      confidence: params.result.data?.confidence ?? null,
      fellBack: params.fellBack,
      fallbackReason: params.fallbackReason,
      latencyMs: params.result.latencyMs,
      // Token usage — only persisted when the provider actually reports it.
      // Never faked. null means usage was unavailable.
      tokensUsed: params.result.tokensUsed ?? null,
    },
  });

  // Record usage.
  let status: "SUCCESS" | "FAILED" | "TIMEOUT" | "VALIDATION_FAILED" | "FALLBACK" = "SUCCESS";
  if (params.fellBack) status = "FALLBACK";
  else if (params.result.error?.includes("timeout")) status = "TIMEOUT";
  else if (params.result.error?.includes("validation")) status = "VALIDATION_FAILED";
  else if (params.result.error) status = "FAILED";

  await recordUsage({
    userId: params.customerId,
    sessionId: params.sessionId,
    requestType: params.requestType,
    provider: "gemini",
    model: params.result.model,
    status,
    latencyMs: params.result.latencyMs,
    tokensUsed: params.result.tokensUsed,
    usageAvailable: params.result.usageAvailable,
  });

  return analysis;
}

// ─────────────────────── Problem interpretation ───────────────────────
import { findErrorCode } from "@/services/error-code-service";
import { resolveSafety } from "@/services/safety-resolution";

export async function interpretProblem(
  customerId: string,
  userText: string,
  sessionId?: string,
): Promise<{
  interpretation: ProblemInterpretation | null;
  safety: SafetyGateResult;
  analysisId: string;
  fellBack: boolean;
  fallbackReason?: string;
}> {
  const knowledge = await retrieveKnowledge(userText);
  const knowledgeStr = formatKnowledgeForPrompt(knowledge);
  const prompts = problemInterpretationPrompt(sanitizeUserText(userText), knowledgeStr);

  const result = await getAIProvider().interpretProblem(prompts.system, prompts.user);

  let safety: SafetyGateResult = { decision: "PASS", finalSafetyLevel: "SAFE" };
  let fellBack = false;
  let fallbackReason: string | undefined;

  if (result.error || !result.data) {
    fellBack = true;
    fallbackReason = result.error ?? "No data returned";
    safety = { decision: "PASS", finalSafetyLevel: "SAFE" };
  } else {
    // 1. Check Error Code
    let errorCodeMatch: any = null;
    if (result.data.errorCode) {
      const { data } = await findErrorCode({
        categorySlug: result.data.equipment.category,
        equipmentType: result.data.equipment.type,
        brand: result.data.equipment.brand,
        model: result.data.equipment.model,
        code: result.data.errorCode,
      });
      errorCodeMatch = data;
    }

    // 2. Resolve Safety deterministically
    const safetyResult = resolveSafety({
      aiSafetyLevel: "SAFE", // Base default, interpretation schema doesn't have safetyLevel, just escalationRequired
      aiEscalationRequired: result.data.escalationRequired,
      symptomsText: result.data.summary + " " + result.data.safetyConcerns.join(" "),
      errorCodeMatch,
      knowledgeCoverage: result.data.knowledgeCoverage,
    });

    let decision: SafetyGateResult["decision"] = "PASS";
    if (safetyResult.finalSafetyLevel === "EMERGENCY_STOP" || safetyResult.finalSafetyLevel === "PROFESSIONAL_ONLY") {
      decision = "ESCALATE";
    }

    safety = {
      decision,
      finalSafetyLevel: safetyResult.finalSafetyLevel,
      reason: safetyResult.reason,
    };
  }

  const analysis = await persistAnalysis({
    sessionId,
    customerId,
    requestType: "interpret_problem",
    result,
    safety,
    fellBack,
    fallbackReason,
  });

  return {
    interpretation: result.data ?? null,
    safety,
    analysisId: analysis.id,
    fellBack,
    fallbackReason,
  };
}

// ─────────────────────── Hypotheses ───────────────────────
export async function generateHypotheses(
  customerId: string,
  sessionId: string,
  context: string,
  categoryId?: string,
): Promise<{
  hypotheses: Hypotheses | null;
  safety: SafetyGateResult;
  analysisId: string;
  fellBack: boolean;
}> {
  const knowledge = categoryId
    ? await retrieveCauseSafetyMap(categoryId)
    : {};
  const knowledgeStr = Object.entries(knowledge)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const prompts = hypothesesPrompt(context, knowledgeStr);
  const result = await getAIProvider().generateHypotheses(prompts.system, prompts.user);

  let safety: SafetyGateResult = { decision: "PASS", finalSafetyLevel: "SAFE" };
  let fellBack = false;

  if (result.error || !result.data) {
    fellBack = true;
  } else {
    safety = gateHypotheses(result.data.hypotheses, knowledge);
  }

  const analysis = await persistAnalysis({
    sessionId,
    customerId,
    requestType: "generate_hypotheses",
    result,
    safety,
    fellBack,
    fallbackReason: result.error ?? undefined,
  });

  // Persist individual hypotheses.
  if (result.data && !fellBack) {
    for (const h of result.data.hypotheses) {
      const matchedCause = await db.possibleCause.findFirst({
        where: { name: { equals: h.causeName } },
      });
      await db.aIHypothesis.create({
        data: {
          analysisId: analysis.id,
          causeName: h.causeName,
          explanation: h.explanation,
          confidence: h.confidence,
          safetyLevel: h.safetyLevel,
          supportingEvidence: JSON.stringify(h.supportingEvidence),
          contradictingEvidence: JSON.stringify(h.contradictingEvidence),
          requiredVerification: h.requiredVerification,
          verified: !!matchedCause,
          matchedCauseId: matchedCause?.id,
        },
      });
    }
  }

  return { hypotheses: result.data ?? null, safety, analysisId: analysis.id, fellBack };
}

// ─────────────────────── Clarifying question ───────────────────────
export async function generateClarifyingQuestion(
  customerId: string,
  sessionId: string,
  context: string,
  knowledgeContext?: string,
): Promise<{
  question: ClarifyingQuestion | null;
  analysisId: string;
  fellBack: boolean;
}> {
  const prompts = clarifyingQuestionPrompt(context, knowledgeContext ?? "");
  const result = await getAIProvider().generateClarifyingQuestion(prompts.system, prompts.user);
  const fellBack = !!result.error || !result.data;
  const analysis = await persistAnalysis({
    sessionId,
    customerId,
    requestType: "clarify",
    result,
    safety: { decision: "PASS", finalSafetyLevel: "SAFE" },
    fellBack,
    fallbackReason: result.error ?? undefined,
  });
  return { question: result.data ?? null, analysisId: analysis.id, fellBack };
}

// ─────────────────────── Image analysis ───────────────────────
export async function analyzeImage(
  customerId: string,
  sessionId: string,
  imageDataUrl: string,
  equipmentContext: string,
  problemContext: string,
  mediaId?: string,
): Promise<{
  analysis: ImageAnalysis | null;
  safety: SafetyGateResult;
  analysisId: string;
  fellBack: boolean;
}> {
  const prompts = imageAnalysisPrompt(equipmentContext, problemContext);
  const result = await getAIProvider().analyzeImage(prompts.system, prompts.user, imageDataUrl);

  let safety: SafetyGateResult = { decision: "PASS", finalSafetyLevel: "SAFE" };
  let fellBack = false;

  if (result.error || !result.data) {
    fellBack = true;
  } else {
    safety = gateImageAnalysis(result.data);
  }

  const analysis = await persistAnalysis({
    sessionId,
    customerId,
    requestType: "analyze_image",
    result,
    safety,
    fellBack,
    fallbackReason: result.error ?? undefined,
  });

  // Persist observations.
  if (result.data && !fellBack) {
    for (const obs of result.data.observations) {
      await db.aIObservation.create({
        data: {
          analysisId: analysis.id,
          mediaId,
          observationType: obs.observationType,
          description: obs.description,
          extractedData: obs.extractedData ? JSON.stringify(obs.extractedData) : null,
        },
      });
    }
  }

  return { analysis: result.data ?? null, safety, analysisId: analysis.id, fellBack };
}

// ─────────────────────── Troubleshooting explanation ───────────────────────
export async function explainTroubleshootingStep(
  customerId: string,
  sessionId: string,
  step: { title: string; description: string; instructions: string },
  causeContext: string,
): Promise<{
  explanation: TroubleshootingExplanation | null;
  analysisId: string;
  fellBack: boolean;
}> {
  const prompts = troubleshootingExplanationPrompt(
    step.title,
    step.description,
    step.instructions,
    causeContext,
  );
  const result = await getAIProvider().explainTroubleshooting(prompts.system, prompts.user);
  const fellBack = !!result.error || !result.data;
  const analysis = await persistAnalysis({
    sessionId,
    customerId,
    requestType: "explain_step",
    result,
    safety: { decision: "PASS", finalSafetyLevel: "SAFE" },
    fellBack,
    fallbackReason: result.error ?? undefined,
  });
  return { explanation: result.data ?? null, analysisId: analysis.id, fellBack };
}

// ─────────────────────── Technician brief ───────────────────────
export async function generateTechnicianBrief(
  customerId: string,
  diagnosticData: string,
  repairRequestId?: string,
): Promise<{
  brief: TechnicianBrief | null;
  analysisId: string;
  fellBack: boolean;
}> {
  const prompts = technicianBriefPrompt(diagnosticData);
  const result = await getAIProvider().generateTechnicianBrief(prompts.system, prompts.user);
  const fellBack = !!result.error || !result.data;
  const analysis = await persistAnalysis({
    customerId,
    requestType: "technician_brief",
    result,
    safety: { decision: "PASS", finalSafetyLevel: "SAFE" },
    fellBack,
    fallbackReason: result.error ?? undefined,
  });
  return { brief: result.data ?? null, analysisId: analysis.id, fellBack };
}

// ─────────────────────── Repair summary ───────────────────────
export async function generateRepairSummary(
  customerId: string,
  repairData: string,
  jobId?: string,
): Promise<{
  summary: RepairSummary | null;
  analysisId: string;
  fellBack: boolean;
}> {
  const prompts = repairSummaryPrompt(repairData);
  const result = await getAIProvider().generateRepairSummary(prompts.system, prompts.user);
  const fellBack = !!result.error || !result.data;
  const analysis = await persistAnalysis({
    customerId,
    requestType: "repair_summary",
    result,
    safety: { decision: "PASS", finalSafetyLevel: "SAFE" },
    fellBack,
    fallbackReason: result.error ?? undefined,
  });
  return { summary: result.data ?? null, analysisId: analysis.id, fellBack };
}

// ─────────────────────── Match explanation ───────────────────────
export async function explainMatch(
  customerId: string,
  matchData: string,
): Promise<{
  explanation: MatchExplanation | null;
  analysisId: string;
  fellBack: boolean;
}> {
  const prompts = matchExplanationPrompt(matchData);
  const result = await getAIProvider().explainMatch(prompts.system, prompts.user);
  const fellBack = !!result.error || !result.data;
  const analysis = await persistAnalysis({
    customerId,
    requestType: "match_explain",
    result,
    safety: { decision: "PASS", finalSafetyLevel: "SAFE" },
    fellBack,
    fallbackReason: result.error ?? undefined,
  });
  return { explanation: result.data ?? null, analysisId: analysis.id, fellBack };
}

// ─────────────────────── Conversational response ───────────────────────
export async function converse(
  customerId: string,
  sessionId: string,
  conversationContext: string,
  knowledgeContext?: string,
): Promise<{
  response: ConversationResponse | null;
  analysisId: string;
  fellBack: boolean;
}> {
  const prompts = conversationPrompt(conversationContext, knowledgeContext ?? "");
  const result = await getAIProvider().converse(prompts.system, prompts.user);
  const fellBack = !!result.error || !result.data;
  const analysis = await persistAnalysis({
    sessionId,
    customerId,
    requestType: "converse",
    result,
    safety: { decision: "PASS", finalSafetyLevel: "SAFE" },
    fellBack,
    fallbackReason: result.error ?? undefined,
  });
  return { response: result.data ?? null, analysisId: analysis.id, fellBack };
}
