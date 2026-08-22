import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

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

    // Notify technician.
    const tech = await db.technicianProfile.findUnique({
      where: { id: parsed.technicianId },
      include: { user: true },
    });
    if (tech) {
      await db.notification.create({
        data: {
          userId: tech.userId,
          type: "repair_request_received",
          title: "New repair request",
          body: `A customer selected you for a ${rr.id.slice(-6)} repair request.`,
          dataJson: JSON.stringify({ repairRequestId: id }),
        },
      });
    }

    return ok({ request: updated });
  } catch (e) {
    return apiError(e);
  }
}
