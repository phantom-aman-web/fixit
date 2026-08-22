import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { recordStepResult } from "@/services/diagnostic-engine";

const schema = z.object({
  stepId: z.string(),
  status: z.enum(["SOLVED", "FAILED", "SKIPPED"]),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const session = await db.diagnosticSession.findUnique({ where: { id } });
    if (!session || session.customerId !== profile.id) throw new HttpError(404, "Session not found");
    const body = await req.json();
    const parsed = schema.parse(body);
    const state = await recordStepResult(id, parsed.stepId, parsed.status, parsed.notes);
    return ok({ state });
  } catch (e) {
    return apiError(e);
  }
}
