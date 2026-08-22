import { EquipmentErrorCode } from "@prisma/client";
import { SafetyLevel, HIGH_RISK_KEYWORDS, RISK_RANK } from "@/lib/ai/safety";

export interface SafetyResolutionParams {
  aiSafetyLevel: SafetyLevel;
  aiEscalationRequired: boolean;
  symptomsText: string;
  errorCodeMatch?: EquipmentErrorCode | null;
  knowledgeCoverage: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
}

export interface SafetyResolutionResult {
  finalSafetyLevel: SafetyLevel;
  professionalRequired: boolean;
  reason: string;
}

export function resolveSafety(params: SafetyResolutionParams): SafetyResolutionResult {
  let maxRisk: SafetyLevel = "SAFE";
  let professionalRequired = false;
  let reason = "Standard diagnostic procedures apply.";

  // 1. AI Base Suggestion (Weakest)
  maxRisk = params.aiSafetyLevel;

  // 2. Knowledge Coverage Check (Conservative Fallback)
  if (params.knowledgeCoverage === "UNKNOWN" || params.knowledgeCoverage === "LOW") {
    if (RISK_RANK[maxRisk] < RISK_RANK["CAUTION"]) {
      maxRisk = "CAUTION";
      reason = "Limited equipment knowledge coverage. Proceed with caution.";
    }
  }

  // 3. Error Code Knowledge (Stronger)
  if (params.errorCodeMatch) {
    const dbRisk = params.errorCodeMatch.riskLevel as SafetyLevel;
    if (RISK_RANK[dbRisk] > RISK_RANK[maxRisk]) {
      maxRisk = dbRisk;
      reason = `Verified error code risk requires ${dbRisk}.`;
    }
    if (params.errorCodeMatch.professionalRequired) {
      professionalRequired = true;
      maxRisk = "PROFESSIONAL_ONLY";
      reason = "Verified error code strictly requires professional service.";
    }
  }

  // 4. Raw Symptoms / Active Hazards (Strongest)
  const lowerSymptoms = params.symptomsText.toLowerCase();
  const foundHazards = HIGH_RISK_KEYWORDS.filter((k) => lowerSymptoms.includes(k));
  if (foundHazards.length > 0) {
    maxRisk = "PROFESSIONAL_ONLY";
    professionalRequired = true;
    reason = `Dangerous symptoms detected (${foundHazards.join(", ")}). Professional service strictly required.`;
  }

  if (params.aiEscalationRequired && RISK_RANK[maxRisk] < RISK_RANK["PROFESSIONAL_ONLY"]) {
    // If AI strongly escalates due to safety, we respect it only if it upgrades risk.
    // The AI CANNOT downgrade a PROFESSIONAL_ONLY to SAFE.
    maxRisk = "PROFESSIONAL_ONLY";
    professionalRequired = true;
    reason = "AI safety rules requested escalation.";
  }

  return {
    finalSafetyLevel: maxRisk,
    professionalRequired: professionalRequired || maxRisk === "PROFESSIONAL_ONLY",
    reason,
  };
}
