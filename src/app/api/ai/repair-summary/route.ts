import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { generateRepairSummary } from "@/services/ai-service";
import { db } from "@/lib/db";

const schema = z.object({ jobId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = schema.parse(body);

    const job = await db.repairJob.findUnique({
      where: { id: parsed.jobId },
      include: {
        booking: {
          include: {
            customer: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } },
            technician: true,
            repairRequest: {
              include: {
                problem: { include: { category: true } },
                session: { include: { diagnoses: { include: { cause: true } } } },
                quote: { include: { items: true } },
              },
            },
            quote: true,
          },
        },
        parts: true,
        review: true,
        warranty: true,
      },
    });
    if (!job) throw new HttpError(404, "Job not found");

    const isOwner = job.booking.customer.userId === user.id;
    const isTech = job.booking.technician?.userId === user.id;
    if (user.role !== "ADMIN" && !isOwner && !isTech) {
      throw new HttpError(403, "Not authorized");
    }

    const repairData = JSON.stringify({
      problem: job.booking.repairRequest.problem.description,
      category: job.booking.repairRequest.problem.category.name,
      diagnosis: job.diagnosis,
      workPerformed: job.workPerformed,
      parts: job.parts.map((p) => ({ name: p.name, quantity: p.quantity, cost: p.totalCost })),
      diagnoses: job.booking.repairRequest.session?.diagnoses.map((d) => ({ cause: d.cause.name, confidence: d.confidence })) ?? [],
      quote: job.booking.quote ? { total: job.booking.quote.totalEstimate, warrantyMonths: job.booking.quote.warrantyMonths } : null,
      warranty: job.warranty ? { durationMonths: job.warranty.durationMonths, coveredWork: job.warranty.coveredWork } : null,
      status: job.status,
    }, null, 2);

    const result = await generateRepairSummary(job.booking.customer.userId, repairData, job.id);

    return ok({
      summary: result.summary,
      analysisId: result.analysisId,
      fellBack: result.fellBack,
    });
  } catch (e) {
    return apiError(e);
  }
}

