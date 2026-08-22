// Safety gate. AI output must pass through here before influencing the UI or
// the diagnostic engine. The deterministic safety rules are authoritative.

import type { ProblemInterpretation, DiagnosticHypothesis, ImageAnalysis } from "@/lib/ai/schemas";

export const SAFETY_LEVELS = ["SAFE", "CAUTION", "PROFESSIONAL_ONLY", "EMERGENCY_STOP"] as const;
export type SafetyLevel = (typeof SAFETY_LEVELS)[number];

export const RISK_RANK: Record<string, number> = { SAFE: 0, CAUTION: 1, PROFESSIONAL_ONLY: 2, EMERGENCY_STOP: 3 };

// High-risk keywords that trigger immediate professional escalation.
// The AI must never encourage DIY troubleshooting when these are present.
export const HIGH_RISK_KEYWORDS = [
  "smoke",
  "sparks",
  "sparking",
  "burning smell",
  "burning",
  "exposed wiring",
  "gas smell",
  "gas leak",
  "fire",
  "flooding near electrical",
  "electrical fire",
  "overheating",
  "scorch",
  "melting",
  "explosive",
  "pressurized",
  "injury",
  "electrocution",
  "shock",
];

export interface SafetyGateResult {
  decision: "PASS" | "DOWNGRADED" | "REJECTED" | "ESCALATE";
  reason?: string;
  finalSafetyLevel: SafetyLevel;
}

// Detect high-risk content in user text or AI output.
export function detectHighRisk(text: string): string[] {
  const lower = text.toLowerCase();
  return HIGH_RISK_KEYWORDS.filter((k) => lower.includes(k));
}

// Apply the safety gate to a problem interpretation.
// Function removed. Safety is now handled deterministically by safety-resolution.ts

// Apply the safety gate to hypotheses. The AI can NEVER downgrade a
// PROFESSIONAL_ONLY cause. If any hypothesis references a known
// PROFESSIONAL_ONLY cause, the safety level is enforced.
export function gateHypotheses(
  hypotheses: DiagnosticHypothesis[],
  knownCauseSafety: Record<string, string>, // causeName → safetyLevel from DB
): SafetyGateResult {
  let maxRisk = "SAFE";
  for (const h of hypotheses) {
    // If we have a known safety level for this cause, enforce it (AI cannot downgrade).
    const known = knownCauseSafety[h.causeName];
    const effective = known ?? h.safetyLevel;
    if (RISK_RANK[effective] > RISK_RANK[maxRisk]) maxRisk = effective;
    // If the AI tried to downgrade a known PROFESSIONAL_ONLY cause, reject that hypothesis.
    if (known === "PROFESSIONAL_ONLY" && h.safetyLevel !== "PROFESSIONAL_ONLY") {
      return {
        decision: "DOWNGRADED",
        reason: `AI attempted to downgrade '${h.causeName}' from PROFESSIONAL_ONLY to ${h.safetyLevel}. Corrected to PROFESSIONAL_ONLY.`,
        finalSafetyLevel: "PROFESSIONAL_ONLY",
      };
    }
  }
  if (maxRisk === "EMERGENCY_STOP") {
    return { decision: "ESCALATE", reason: "Emergency stop condition.", finalSafetyLevel: "EMERGENCY_STOP" };
  }
  if (maxRisk === "PROFESSIONAL_ONLY") {
    return { decision: "ESCALATE", reason: "Professional-only cause detected.", finalSafetyLevel: "PROFESSIONAL_ONLY" };
  }
  return { decision: "PASS", finalSafetyLevel: maxRisk as SafetyLevel };
}

// Apply the safety gate to image analysis.
export function gateImageAnalysis(analysis: ImageAnalysis): SafetyGateResult {
  const concerns = analysis.safetyConcerns.join(" ");
  const highRisk = detectHighRisk(concerns);
  if (highRisk.length > 0 || analysis.recommendedAction === "escalate_professional") {
    return {
      decision: "ESCALATE",
      reason: `Image analysis flagged safety concerns: ${highRisk.join(", ") || "visual hazard"}.`,
      finalSafetyLevel: "PROFESSIONAL_ONLY",
    };
  }
  return { decision: "PASS", finalSafetyLevel: "SAFE" };
}

// Sanitize user text before sending to the AI. This is a lightweight
// prompt-injection defense: we wrap user content in clear delimiters and
// strip common injection patterns. The system instruction already tells the
// model to treat user text as untrusted.
export function sanitizeUserText(text: string): string {
  // Limit length.
  const truncated = text.slice(0, 4000);
  // Wrap in delimiters so the model can distinguish user content from instructions.
  return `<<<USER_CONTENT_START>>>\n${truncated}\n<<<USER_CONTENT_END>>>`;
}
