import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProvider, AIProviderCallResult } from "./index";
import * as schemas from "../schemas";
import { z } from "zod";

async function callGemini<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  imageParts?: Array<{ inlineData: { data: string; mimeType: string } }>
): Promise<AIProviderCallResult<T>> {
  const startTime = Date.now();
  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  
  let attempt = 0;
  const maxRetries = 3;

  while (attempt <= maxRetries) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const configuredModel = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt + `\n\nIMPORTANT: You MUST return a single raw JSON object that strictly matches the expected schema. Do not use markdown blocks. Do not add conversational text outside the JSON.`,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const parts: any[] = [{ text: userPrompt }];
      if (imageParts && imageParts.length > 0) {
        parts.push(...imageParts);
      }

      const result = await configuredModel.generateContent({
        contents: [{ role: "user", parts }],
      });
      
      const latencyMs = Date.now() - startTime;
      const text = result.response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
        try {
          data = JSON.parse(cleaned);
        } catch (e2) {
          return {
            error: "Malformed JSON response from Gemini",
            latencyMs,
            usageAvailable: false,
            model: modelName
          };
        }
      }
      
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        return {
          error: `Validation failed: ${parsed.error.message}`,
          latencyMs,
          usageAvailable: false,
          model: modelName
        };
      }
      
      const usageMetadata = result.response.usageMetadata;
      const tokensUsed = usageMetadata?.totalTokenCount;

      return {
        data: parsed.data,
        latencyMs,
        tokensUsed,
        usageAvailable: !!tokensUsed,
        model: modelName
      };
    } catch (error: any) {
      const isRateLimit = error.message && (error.message.includes("429") || error.message.includes("Quota"));
      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        const delayMs = Math.pow(2, attempt) * 1500 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return {
        error: error.message || "Unknown Gemini Error",
        latencyMs: Date.now() - startTime,
        usageAvailable: false,
        model: modelName
      };
    }
  }

  return {
    error: "Max retries exceeded",
    latencyMs: Date.now() - startTime,
    usageAvailable: false,
    model: modelName
  };
}

export const geminiProvider: AIProvider = {
  interpretProblem: (sys, user) => callGemini(sys, user, schemas.ProblemInterpretationSchema),
  generateHypotheses: (sys, user) => callGemini(sys, user, schemas.HypothesesSchema),
  generateClarifyingQuestion: (sys, user) => callGemini(sys, user, schemas.ClarifyingQuestionSchema),
  analyzeImage: (sys, user, base64Image) => {
    const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return Promise.resolve({
        error: "Invalid base64 image data URL",
        latencyMs: 0,
        usageAvailable: false,
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash"
      });
    }
    const mimeType = match[1];
    const data = match[2];
    return callGemini(sys, user, schemas.ImageAnalysisSchema, [
      { inlineData: { data, mimeType } }
    ]);
  },
  explainTroubleshooting: (sys, user) => callGemini(sys, user, schemas.TroubleshootingExplanationSchema),
  generateTechnicianBrief: (sys, user) => callGemini(sys, user, schemas.TechnicianBriefSchema),
  generateRepairSummary: (sys, user) => callGemini(sys, user, schemas.RepairSummarySchema),
  explainMatch: (sys, user) => callGemini(sys, user, schemas.MatchExplanationSchema),
  converse: (sys, user) => callGemini(sys, user, schemas.ConversationResponseSchema),
};
