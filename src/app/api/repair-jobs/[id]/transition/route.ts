import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { transitionRepairJob, canTransition } from "@/services/state-machines";

const schema = z.object({ status: z.string(), note: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const job = await db.repairJob.findUnique({
      where: { id },
      include: { booking: { include: { technician: true, customer: true } } },
    });
    if (!job) throw new HttpError(404, "Repair job not found");

    const isTech = job.booking.technician?.userId === user.id;
    const isCust = job.booking.customer?.userId === user.id;
    if (user.role !== "ADMIN" && !isTech && !isCust) throw new HttpError(403, "Not authorized");
    // Only the technician (or admin) advances the workflow; customer may not.
    if (!isTech && user.role !== "ADMIN") throw new HttpError(403, "Only the technician can update the job status");

    if (!canTransition("REPAIR_JOB", job.status, parsed.status)) {
      throw new HttpError(400, `Cannot transition job ${job.status} → ${parsed.status}`);
    }

    await transitionRepairJob(id, parsed.status, parsed.note);
    // notifyJobStatus + realtimeJobStatus are already called inside
    // transitionRepairJob — do not duplicate here.

    const updated = await db.repairJob.findUnique({
      where: { id },
      include: { booking: { include: { technician: true, customer: true, repairRequest: { include: { problem: true } } } }, statusHistory: { orderBy: { createdAt: "desc" } }, parts: true },
    });
    return ok({ job: updated });
  } catch (e) {
    return apiError(e);
  }
}
