import { NextRequest } from "next/server";
import { ok, apiError, HttpError } from "@/lib/api";
import { getAvailableSlots } from "@/services/scheduling-service";
import { db } from "@/lib/db";

// GET /api/technician/slots/[date]?technicianId=X
// Returns available time slots for a technician on a given date.
export async function GET(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await params;
    const { searchParams } = new URL(req.url);
    const technicianId = searchParams.get("technicianId");
    if (!technicianId) throw new HttpError(400, "technicianId required");

    const tech = await db.technicianProfile.findUnique({ where: { id: technicianId } });
    if (!tech) throw new HttpError(404, "Technician not found");

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) throw new HttpError(400, "Invalid date");

    const slots = await getAvailableSlots(technicianId, parsedDate);
    return ok({ slots, date: parsedDate.toISOString() });
  } catch (e) {
    return apiError(e);
  }
}
