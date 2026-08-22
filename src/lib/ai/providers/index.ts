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
} from "../schemas";

export interface AIProviderCallResult<T> {
  data?: T;
  error?: string;
  latencyMs: number;
  tokensUsed?: number;
  usageAvailable: boolean;
  model: string;
}

export interface AIProvider {
  interpretProblem(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<ProblemInterpretation>>;
  generateHypotheses(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<Hypotheses>>;
  generateClarifyingQuestion(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<ClarifyingQuestion>>;
  analyzeImage(systemPrompt: string, userPrompt: string, base64Image: string): Promise<AIProviderCallResult<ImageAnalysis>>;
  explainTroubleshooting(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<TroubleshootingExplanation>>;
  generateTechnicianBrief(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<TechnicianBrief>>;
  generateRepairSummary(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<RepairSummary>>;
  explainMatch(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<MatchExplanation>>;
  converse(systemPrompt: string, userPrompt: string): Promise<AIProviderCallResult<ConversationResponse>>;
}

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider as AIProvider;

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    // Dynamic import to avoid loading Gemini SDK if not configured
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { geminiProvider } = require("./gemini-provider");
    cachedProvider = geminiProvider;
    return cachedProvider as AIProvider;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { zaiProvider } = require("./zai-provider");
  cachedProvider = zaiProvider;
  return cachedProvider as AIProvider;
}
