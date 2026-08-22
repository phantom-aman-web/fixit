// ZAI AI provider — the actual implementation backed by z-ai-web-dev-sdk.
// This is the ONLY file in the codebase that imports z-ai-web-dev-sdk.
// All other code depends on the AIProvider interface.

import ZAI from "z-ai-web-dev-sdk";
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

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getClient() {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
}

export interface AIProviderCallResult<T> {
  data: T | null;
  raw: string;
  error: string | null;
  latencyMs: number;
  model: string;
  tokensUsed: number | null; // null if provider doesn't report usage
  usageAvailable: boolean;
}

const MAX_RETRIES = 1; // 1 retry for transient failures (total 2 attempts)
const RETRY_DELAY_MS = 1000;

function isTransientError(error: string): boolean {
  // Retry on timeout, network, and generic provider errors.
  // NEVER retry validation failures (those will fail identically).
  const lower = error.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("service unavailable")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Core: call the LLM with a system + user prompt and parse JSON.
// Includes bounded retry for transient failures + token usage capture.
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 30000,
): Promise<AIProviderCallResult<unknown>> {
  const start = Date.now();
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await getClient();
      const completion = await Promise.race([
        client.chat.completions.create({
          messages: [
            { role: "assistant", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          thinking: { type: "disabled" },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      const raw = completion.choices[0]?.message?.content ?? "";

      // Capture token usage if the provider reports it.
      // The z-ai-web-dev-sdk may expose usage as completion.usage.
      const usage = (completion as any)?.usage;
      const tokensUsed = usage?.total_tokens ?? (usage?.prompt_tokens != null && usage?.completion_tokens != null ? usage.prompt_tokens + usage.completion_tokens : null);

      return {
        data: null,
        raw,
        error: null,
        latencyMs: Date.now() - start,
        model: "zai-llm",
        tokensUsed,
        usageAvailable: tokensUsed != null,
      };
    } catch (e: any) {
      lastError = e?.message ?? "Unknown AI error";
      // Retry only on transient errors, and only if we haven't exhausted retries.
      if (attempt < MAX_RETRIES && isTransientError(lastError!)) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      break;
    }
  }

  return {
    data: null,
    raw: "",
    error: lastError,
    latencyMs: Date.now() - start,
    model: "zai-llm",
    tokensUsed: null,
    usageAvailable: false,
  };
}

// Core: call the VLM with an image (base64 data URL).
async function callVLM(
  systemPrompt: string,
  userPrompt: string,
  imageDataUrl: string,
  timeoutMs = 45000,
): Promise<AIProviderCallResult<unknown>> {
  const start = Date.now();
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await getClient();
      const completion = await Promise.race([
        client.chat.completions.createVision({
          messages: [
            { role: "assistant", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ] as any,
            },
          ],
          thinking: { type: "disabled" },
        } as any),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI vision timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      const raw = completion.choices[0]?.message?.content ?? "";
      const usage = (completion as any)?.usage;
      const tokensUsed = usage?.total_tokens ?? null;

      return {
        data: null,
        raw,
        error: null,
        latencyMs: Date.now() - start,
        model: "zai-vlm",
        tokensUsed,
        usageAvailable: tokensUsed != null,
      };
    } catch (e: any) {
      lastError = e?.message ?? "Unknown AI vision error";
      if (attempt < MAX_RETRIES && isTransientError(lastError!)) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      break;
    }
  }

  return {
    data: null,
    raw: "",
    error: lastError,
    latencyMs: Date.now() - start,
    model: "zai-vlm",
    tokensUsed: null,
    usageAvailable: false,
  };
}

// Extract JSON from a model response that may contain markdown fences or
// surrounding prose. We find the first { ... } block and parse it.
function extractJSON(raw: string): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // fall through
    }
  }
  return null;
}

// ─────────────────────── Provider methods ───────────────────────
import { z } from "zod";

async function callAndParse<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<AIProviderCallResult<T>> {
  const res = await callLLM(systemPrompt, userPrompt);
  if (res.error) return { ...res, data: null } as AIProviderCallResult<T>;
  const json = extractJSON(res.raw);
  if (!json) {
    return { ...res, data: null, error: "AI returned non-JSON response" } as AIProviderCallResult<T>;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ...res,
      data: null,
      error: `AI response failed validation: ${parsed.error.issues[0]?.message}`,
    } as AIProviderCallResult<T>;
  }
  return { ...res, data: parsed.data, error: null } as AIProviderCallResult<T>;
}

export const zaiProvider = {
  async interpretProblem(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<ProblemInterpretation>> {
    const { ProblemInterpretationSchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, ProblemInterpretationSchema);
  },

  async generateHypotheses(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<Hypotheses>> {
    const { HypothesesSchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, HypothesesSchema);
  },

  async generateClarifyingQuestion(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<ClarifyingQuestion>> {
    const { ClarifyingQuestionSchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, ClarifyingQuestionSchema);
  },

  async analyzeImage(
    systemPrompt: string,
    userPrompt: string,
    imageDataUrl: string,
  ): Promise<AIProviderCallResult<ImageAnalysis>> {
    const { ImageAnalysisSchema } = await import("@/lib/ai/schemas");
    const res = await callVLM(systemPrompt, userPrompt, imageDataUrl);
    if (res.error) return { ...res, data: null } as AIProviderCallResult<ImageAnalysis>;
    const json = extractJSON(res.raw);
    if (!json) return { ...res, data: null, error: "AI vision returned non-JSON" } as AIProviderCallResult<ImageAnalysis>;
    const parsed = ImageAnalysisSchema.safeParse(json);
    if (!parsed.success) {
      return { ...res, data: null, error: `AI vision validation failed: ${parsed.error.issues[0]?.message}` } as AIProviderCallResult<ImageAnalysis>;
    }
    return { ...res, data: parsed.data, error: null } as AIProviderCallResult<ImageAnalysis>;
  },

  async explainTroubleshooting(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<TroubleshootingExplanation>> {
    const { TroubleshootingExplanationSchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, TroubleshootingExplanationSchema);
  },

  async generateTechnicianBrief(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<TechnicianBrief>> {
    const { TechnicianBriefSchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, TechnicianBriefSchema);
  },

  async generateRepairSummary(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<RepairSummary>> {
    const { RepairSummarySchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, RepairSummarySchema);
  },

  async explainMatch(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<MatchExplanation>> {
    const { MatchExplanationSchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, MatchExplanationSchema);
  },

  async converse(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<AIProviderCallResult<ConversationResponse>> {
    const { ConversationResponseSchema } = await import("@/lib/ai/schemas");
    return callAndParse(systemPrompt, userPrompt, ConversationResponseSchema);
  },
};
