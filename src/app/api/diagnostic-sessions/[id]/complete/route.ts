import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { completeDiagnosis } from "@/services/diagnostic-engine";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const session = await db.diagnosticSession.findUnique({ where: { id } });
    if (!session || session.customerId !== profile.id) throw new HttpError(404, "Session not found");
    const state = await completeDiagnosis(id);
    return ok({ state });
  } catch (e) {
    return apiError(e);
  }
}
