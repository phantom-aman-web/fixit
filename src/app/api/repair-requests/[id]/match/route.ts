import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { computeMatches } from "@/services/matching-engine";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const rr = await db.repairRequest.findUnique({ where: { id } });
    if (!rr || rr.customerId !== profile.id) throw new HttpError(404, "Repair request not found");
    const matches = await computeMatches(id);
    return ok({ matches });
  } catch (e) {
    return apiError(e);
  }
}
