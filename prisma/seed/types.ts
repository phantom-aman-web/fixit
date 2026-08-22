export type SeedOption = { value: string; label: string };

export type SeedQuestion = {
  key: string;
  text: string;
  helpText?: string;
  inputType: string;
  order: number;
  options: SeedOption[];
};

export type SeedTroubleshootingStep = {
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  safetyLevel: string;
  requiredTools: string;
  instructions: string;
  expectedResult: string;
  failureResult: string;
  order: number;
};

export type SeedCause = {
  slug: string;
  name: string;
  description: string;
  riskLevel: string; // SAFE, CAUTION, PROFESSIONAL_ONLY
  baseConfidence: number;
  professionalRecommended: boolean;
  steps: SeedTroubleshootingStep[];
};

export type SeedRule = {
  questionKey: string;
  optionValue: string;
  operator?: string; // eq, ne, contains, any
  causeSlug: string;
  weight?: number;
  escalate?: boolean;
  escalateReason?: string;
};

export type SeedSymptom = {
  slug: string;
  name: string;
  description?: string;
  questions: SeedQuestion[];
  causes: SeedCause[];
  rules: SeedRule[];
};

export type SeedCategory = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  models: { brand: string; model: string }[];
  symptoms: SeedSymptom[];
};

export type SeedErrorCode = {
  brand: string;
  modelPattern?: string;
  code: string;
  meaning: string;
  severity: string; // LOW, NORMAL, HIGH, EMERGENCY
  riskLevel: string; // SAFE, CAUTION, PROFESSIONAL_ONLY
  possibleCauses?: string;
  recommendedActions?: string;
  professionalRequired: boolean;
  categorySlug?: string;
};
