import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { notifyTechnicianAssigned } from "@/services/notifications";

const schema = z.object({ technicianId: z.string() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const rr = await db.repairRequest.findUnique({ where: { id } });
    if (!rr || rr.customerId !== profile.id) throw new HttpError(404, "Repair request not found");
    const body = await req.json();
    const parsed = schema.parse(body);

    const match = await db.technicianMatch.findUnique({
      where: { repairRequestId_technicianId: { repairRequestId: id, technicianId: parsed.technicianId } },
    });
    if (!match) throw new HttpError(404, "That technician was not matched to this request");

    const updated = await db.repairRequest.update({
      where: { id },
      data: { technicianId: parsed.technicianId, status: "TECHNICIAN_SELECTED" },
    });

    // Notify both customer and technician (in-app + email) via centralized service.
    // Fire and forget — notification failure must not roll back the selection.
    void notifyTechnicianAssigned({
      requestId: id,
      customerId: rr.customerId,
      technicianId: parsed.technicianId,
      scheduledAt: new Date(), // Booking date TBD — use current time as placeholder
    });

    return ok({ request: updated });
  } catch (e) {
    return apiError(e);
  }
}
