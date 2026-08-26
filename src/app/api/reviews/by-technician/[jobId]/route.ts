import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { profile } = await requireTechnicianProfile();
    const { jobId } = await params;
    const job = await db.repairJob.findUnique({
      where: { id: jobId },
      include: { booking: true, customerReview: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (job.booking.technicianId !== profile.id) throw new HttpError(403, "Not your job");
    if (job.status !== "COMPLETED") throw new HttpError(400, "Job is not completed");
    if (job.customerReview) throw new HttpError(409, "Review already submitted");

    const body = await req.json();
    const parsed = schema.parse(body);

    const review = await db.customerReview.create({
      data: {
        jobId,
        customerId: job.booking.customerId,
        technicianId: profile.id,
        rating: parsed.rating,
        title: parsed.title,
        body: parsed.body,
      },
    });

    return ok({ review }, 201);
  } catch (e) {
    return apiError(e);
  }
}
