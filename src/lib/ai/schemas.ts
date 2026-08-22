// Zod schemas for structured AI output. Every AI response must validate
// against one of these schemas before it can influence application state.

import { z } from "zod";

// ─────────────────────── Problem interpretation ───────────────────────
// The AI extracts structured diagnostic context from natural language.
// It does NOT declare a diagnosis — only a structured starting point.
export const EquipmentIdentitySchema = z.object({
  category: z.string().nullable().describe("Broad domain. MUST MATCH a provided EQUIPMENT CATEGORY slug exactly (e.g. 'power_tools', 'washing_machine', 'electronics', 'hvac', 'plumbing')."),
  type: z.string().nullable().describe("Specific type, e.g., 'cordless_drill', 'air_conditioner', 'washing_machine'"),
  brand: z.string().nullable(),
  model: z.string().nullable(),
});

export const ProblemInterpretationSchema = z.object({
  equipment: EquipmentIdentitySchema,
  symptoms: z.array(z.string()).describe("Symptom phrases extracted, e.g. ['loud grinding noise', 'during spin cycle']."),
  errorCode: z.string().nullable().describe("Any error code mentioned, e.g., 'E15', 'OE', 'CH05'. Null if none."),
  observations: z.array(z.string()).describe("Factual observations, e.g. ['noise started yesterday', 'machine was recently moved']."),
  timing: z.string().nullable().describe("When the issue occurs, e.g. 'during spin'."),
  onset: z.string().nullable().describe("When the issue started, e.g. 'recently', '2 days ago'."),
  severity: z.enum(["low", "moderate", "high", "unknown"]).describe("Apparent severity."),
  safetyConcerns: z.array(z.string()).describe("Safety keywords detected, e.g. ['burning smell', 'smoke']. Empty if none."),
  summary: z.string().describe("A one-sentence plain-language summary of the reported problem."),
  reply: z.string().describe("A helpful, natural-language conversational reply addressing the user's latest input."),
  confidence: z.number().min(0).max(1).describe("AI confidence in this interpretation (0..1)."),
  knowledgeCoverage: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).describe("Estimated knowledge coverage based on whether this equipment matches known FixIt categories."),
  uncertainty: z.array(z.string()).describe("What information is missing or ambiguous."),
  mappedAnswers: z.array(z.object({
    questionKey: z.string(),
    values: z.array(z.string())
  })).describe("Map symptoms to DIAGNOSTIC QUESTIONS from context. Only use provided keys and values."),
  clarifyingQuestions: z.array(z.object({
    question: z.string(),
    purpose: z.string().describe("Why this question helps the diagnosis."),
    suggestedOptions: z.array(z.string()).optional(),
  })).describe("Useful clarifying questions. May be empty."),
  escalationRequired: z.boolean().describe("True if safety concerns warrant immediate professional escalation."),
});

// ─────────────────────── Hypotheses ───────────────────────
export const DiagnosticHypothesisSchema = z.object({
  causeName: z.string(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  safetyLevel: z.enum(["SAFE", "CAUTION", "PROFESSIONAL_ONLY"]),
  supportingEvidence: z.array(z.string()),
  contradictingEvidence: z.array(z.string()),
  requiredVerification: z.string().nullable(),
});

export const HypothesesSchema = z.object({
  hypotheses: z.array(DiagnosticHypothesisSchema),
  overallConfidence: z.enum(["high", "medium", "low", "needs_more_information"]),
  needsMoreInfo: z.boolean(),
  recommendedAction: z.enum(["continue_troubleshooting", "ask_clarification", "escalate_professional"]),
  reasoning: z.string(),
});

// ─────────────────────── Clarifying question ───────────────────────
export const ClarifyingQuestionSchema = z.object({
  question: z.string(),
  purpose: z.string(),
  suggestedOptions: z.array(z.string()).optional(),
  mapsToDiagnosticKey: z.string().nullable().describe("If this maps to a FixIt diagnostic question key, name it."),
});

// ─────────────────────── Image analysis ───────────────────────
export const ImageObservationSchema = z.object({
  observationType: z.enum(["OBSERVED", "INFERRED", "UNKNOWN"]),
  description: z.string(),
  category: z.enum(["damage", "leak", "blockage", "error_code", "model_label", "component", "installation", "wear", "other"]).nullable(),
  extractedData: z.object({
    errorCode: z.string().nullable(),
    brand: z.string().nullable(),
    modelNumber: z.string().nullable(),
    visibleDamage: z.array(z.string()),
  }).nullable(),
});

export const ImageAnalysisSchema = z.object({
  observations: z.array(ImageObservationSchema),
  summary: z.string(),
  safetyConcerns: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  recommendedAction: z.enum(["continue", "ask_for_better_image", "escalate_professional"]),
});

// ─────────────────────── Troubleshooting explanation ───────────────────────
export const TroubleshootingExplanationSchema = z.object({
  explanation: z.string().describe("Plain-language explanation of why this step helps."),
  whatToExpect: z.string().describe("What the user should see if the step works."),
  safetyNote: z.string().nullable().describe("Any safety caveat, or null."),
  estimatedTime: z.string().nullable(),
});

// ─────────────────────── Technician brief ───────────────────────
export const TechnicianBriefSchema = z.object({
  customerReported: z.string(),
  equipment: z.string(),
  brandModel: z.string().nullable(),
  symptoms: z.array(z.string()),
  whenItOccurs: z.string().nullable(),
  observedEvidence: z.array(z.string()),
  checksPerformed: z.array(z.string()),
  results: z.array(z.string()),
  likelyCauses: z.array(z.string()),
  safety: z.string(),
  mediaCount: z.number().int(),
  confidence: z.string(),
  inspectionChecklist: z.array(z.string()),
});

// ─────────────────────── Repair summary ───────────────────────
export const RepairSummarySchema = z.object({
  problem: z.string(),
  likelyCause: z.string(),
  checksCompleted: z.array(z.string()),
  repairPerformed: z.string().nullable(),
  recommendation: z.string(),
  warrantyNote: z.string().nullable(),
});

// ─────────────────────── Match explanation ───────────────────────
export const MatchExplanationSchema = z.object({
  summary: z.string().describe("Why this technician is a good fit, grounded in actual scores."),
  keyStrengths: z.array(z.string()),
  caveats: z.array(z.string()),
});

// ─────────────────────── Conversational response ───────────────────────
export const ConversationResponseSchema = z.object({
  reply: z.string().describe("The assistant's natural-language reply to the user."),
  extractedInfo: z.object({
    symptoms: z.array(z.string()),
    observations: z.array(z.string()),
    answers: z.array(z.object({
      questionKey: z.string().nullable(),
      values: z.array(z.string()),
    })),
  }).nullable(),
  confidence: z.enum(["high", "medium", "low", "needs_more_information"]),
  recommendedAction: z.enum(["continue_conversation", "proceed_to_diagnosis", "escalate_professional"]),
  safetyFlag: z.boolean().describe("True if the user mentioned a safety concern."),
});

// ─────────────────────── Types ───────────────────────
export type ProblemInterpretation = z.infer<typeof ProblemInterpretationSchema>;
export type DiagnosticHypothesis = z.infer<typeof DiagnosticHypothesisSchema>;
export type Hypotheses = z.infer<typeof HypothesesSchema>;
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>;
export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
export type ImageObservation = z.infer<typeof ImageObservationSchema>;
export type TroubleshootingExplanation = z.infer<typeof TroubleshootingExplanationSchema>;
export type TechnicianBrief = z.infer<typeof TechnicianBriefSchema>;
export type RepairSummary = z.infer<typeof RepairSummarySchema>;
export type MatchExplanation = z.infer<typeof MatchExplanationSchema>;
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
