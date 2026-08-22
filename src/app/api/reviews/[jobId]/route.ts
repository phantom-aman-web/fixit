import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";
import { notifyReviewSubmitted } from "@/services/notifications";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
  qualityRating: z.number().int().min(1).max(5).optional(),
  professionalismRating: z.number().int().min(1).max(5).optional(),
  communicationRating: z.number().int().min(1).max(5).optional(),
  valueRating: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { jobId } = await params;
    const job = await db.repairJob.findUnique({
      where: { id: jobId },
      include: { booking: true, review: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (job.booking.customerId !== profile.id) throw new HttpError(403, "Not your job");
    if (job.status !== "COMPLETED") throw new HttpError(400, "Job is not completed");
    if (job.review) throw new HttpError(409, "Review already submitted");

    const body = await req.json();
    const parsed = schema.parse(body);

    const review = await db.review.create({
      data: {
        jobId,
        customerId: profile.id,
        technicianId: job.booking.technicianId,
        rating: parsed.rating,
        title: parsed.title,
        body: parsed.body,
        qualityRating: parsed.qualityRating,
        professionalismRating: parsed.professionalismRating,
        communicationRating: parsed.communicationRating,
        valueRating: parsed.valueRating,
      },
    });

    // Update technician aggregate rating (simple running average).
    const tech = await db.technicianProfile.findUnique({ where: { id: job.booking.technicianId } });
    if (tech) {
      const newCount = tech.ratingCount + 1;
      const newRating = (tech.rating * tech.ratingCount + parsed.rating) / newCount;
      await db.technicianProfile.update({
        where: { id: tech.id },
        data: { rating: Math.round(newRating * 10) / 10, ratingCount: newCount, completedJobs: tech.completedJobs + 1 },
      });
    }

    // Create warranty if quote specified months.
    const quote = await db.quote.findUnique({ where: { repairRequestId: job.booking.repairRequestId } });
    if (quote?.warrantyMonths) {
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + quote.warrantyMonths);
      await db.warranty.create({
        data: {
          jobId,
          startDate: start,
          endDate: end,
          durationMonths: quote.warrantyMonths,
          coveredWork: "Parts and labor per the approved quote.",
          status: "ACTIVE",
        },
      });
    }

    await notifyReviewSubmitted(review.id);

    return ok({ review }, 201);
  } catch (e) {
    return apiError(e);
  }
}
