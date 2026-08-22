// AI usage tracking — persist a record of every AI call for auditability +
// admin analytics. Never stores secrets or raw prompts; only metadata.

import { db } from "@/lib/db";

export interface UsageRecordInput {
  userId: string;
  sessionId?: string;
  requestType: string;
  provider: string;
  model?: string;
  status: "SUCCESS" | "FAILED" | "TIMEOUT" | "VALIDATION_FAILED" | "FALLBACK";
  latencyMs?: number;
  tokensUsed?: number | null;
  usageAvailable?: boolean;
  estimatedCostUsd?: number | null;
}

export async function recordUsage(input: UsageRecordInput) {
  try {
    await db.aIUsageRecord.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        requestType: input.requestType,
        provider: input.provider,
        model: input.model,
        status: input.status,
        latencyMs: input.latencyMs,
        // Only persist token count when the provider actually reported it.
        tokensUsed: input.usageAvailable ? (input.tokensUsed ?? null) : null,
        // Cost is only calculated when token usage is available AND pricing is
        // configured. For Phase 2, pricing is not configured, so cost stays 0.
        estimatedCostUsd: 0,
      },
    });
  } catch {
    // Usage tracking is best-effort; never fail the business operation.
  }
}

// Aggregate stats for admin dashboard.
export async function getUsageStats() {
  const total = await db.aIUsageRecord.count();
  const byStatus = await db.aIUsageRecord.groupBy({
    by: ["status"],
    _count: true,
  });
  const byType = await db.aIUsageRecord.groupBy({
    by: ["requestType"],
    _count: true,
  });
  const recent = await db.aIUsageRecord.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  const avgLatency = await db.aIUsageRecord.aggregate({
    _avg: { latencyMs: true },
    where: { status: "SUCCESS" },
  });
  const totalCost = await db.aIUsageRecord.aggregate({
    _sum: { estimatedCostUsd: true },
  });

  return {
    total,
    successCount: byStatus.find((s) => s.status === "SUCCESS")?._count ?? 0,
    failedCount: byStatus.find((s) => s.status === "FAILED")?._count ?? 0,
    fallbackCount: byStatus.find((s) => s.status === "FALLBACK")?._count ?? 0,
    validationFailedCount: byStatus.find((s) => s.status === "VALIDATION_FAILED")?._count ?? 0,
    avgLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
    totalCostUsd: totalCost._sum.estimatedCostUsd ?? 0,
    // Distinguish actual usage (tokens reported) from unavailable (provider
    // didn't report token counts). Admin sees honest numbers.
    tokensReportedCount: await db.aIUsageRecord.count({ where: { tokensUsed: { not: null } } }),
    tokensUnavailableCount: await db.aIUsageRecord.count({ where: { tokensUsed: null, status: "SUCCESS" } }),
    byType: byType.map((t) => ({ type: t.requestType, count: t._count })),
    recent,
  };
}
