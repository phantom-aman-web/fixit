import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { startSession, getSessionState } from "@/services/diagnostic-engine";

const schema = z.object({
  categoryId: z.string(),
  symptomId: z.string(),
  problemId: z.string().optional(),
  equipmentId: z.string().optional(),
});

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const sessions = await db.diagnosticSession.findMany({
      where: { customerId: profile.id },
      include: { problem: true, equipment: true },
      orderBy: { startedAt: "desc" },
    });
    return ok({ sessions });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    // If a problemId is provided, ensure ownership.
    if (parsed.problemId) {
      const p = await db.problemReport.findUnique({ where: { id: parsed.problemId } });
      if (!p || p.customerId !== profile.id) throw new HttpError(403, "Not your problem");
    }
    if (parsed.equipmentId) {
      const eq = await db.customerEquipment.findUnique({ where: { id: parsed.equipmentId } });
      if (!eq || eq.customerId !== profile.id) throw new HttpError(403, "Not your equipment");
    }

    const state = await startSession({
      customerId: profile.id,
      categoryId: parsed.categoryId,
      symptomId: parsed.symptomId,
      problemId: parsed.problemId,
      equipmentId: parsed.equipmentId,
    });
    return ok({ state }, 201);
  } catch (e) {
    return apiError(e);
  }
}

// Helper can be exported elsewhere if needed
