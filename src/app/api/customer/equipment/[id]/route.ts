import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const eq = await db.customerEquipment.findUnique({ where: { id } });
    if (!eq || eq.customerId !== profile.id) throw new HttpError(404, "Equipment not found");
    await db.customerEquipment.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
