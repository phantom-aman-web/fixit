import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";

const schema = z.object({
  diagnosis: z.string().max(5000).optional(),
  workPerformed: z.string().max(5000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireTechnicianProfile();
    const { id } = await params;
    const job = await db.repairJob.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (user.role !== "ADMIN" && job.booking.technicianId !== profile.id) {
      throw new HttpError(403, "Not your job");
    }
    const body = await req.json();
    const parsed = schema.parse(body);
    const updated = await db.repairJob.update({
      where: { id },
      data: { diagnosis: parsed.diagnosis, workPerformed: parsed.workPerformed },
    });
    return ok({ job: updated });
  } catch (e) {
    return apiError(e);
  }
}
