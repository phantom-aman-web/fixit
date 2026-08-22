import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ technicianId: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { technicianId } = await params;
    await db.favoriteTechnician.deleteMany({
      where: { customerId: profile.id, technicianId },
    });
    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
