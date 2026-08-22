import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";

const schema = z.object({
  parts: z.array(z.object({
    name: z.string().min(1).max(200),
    partNumber: z.string().max(100).optional(),
    quantity: z.number().int().min(1).default(1),
    unitCost: z.number().int().min(0),
  })),
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
    // Only the assigned technician (or admin) may record parts.
    if (user.role !== "ADMIN" && job.booking.technicianId !== profile.id) {
      throw new HttpError(403, "Not your job");
    }

    const body = await req.json();
    const parsed = schema.parse(body);

    await db.repairPart.deleteMany({ where: { jobId: id } });
    const parts = await db.repairPart.createMany({
      data: parsed.parts.map((p) => ({
        jobId: id,
        name: p.name,
        partNumber: p.partNumber,
        quantity: p.quantity,
        unitCost: p.unitCost,
        totalCost: p.unitCost * p.quantity,
      })),
    });
    return ok({ ok: true, count: parts.count });
  } catch (e) {
    return apiError(e);
  }
}
