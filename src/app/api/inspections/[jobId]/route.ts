import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError, requireAuth } from "@/lib/api";

const schema = z.object({
  observedIssue: z.string().max(2000).optional(),
  physicalCondition: z.string().max(2000).optional(),
  diagnosticChecks: z.string().optional(), // JSON
  errorCodes: z.string().optional(), // JSON array
  suspectedParts: z.string().optional(), // JSON array
  safetyConcerns: z.string().optional(), // JSON array
  notes: z.string().max(5000).optional(),
  photosJson: z.string().optional(), // JSON array of media keys
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuth();
    const { jobId } = await params;
    const job = await db.repairJob.findUnique({
      where: { id: jobId },
      include: { booking: true, inspection: true },
    });
    if (!job) throw new HttpError(404, "Job not found");

    // Authorization: assigned tech, customer owner, or admin.
    const tech = await db.technicianProfile.findUnique({ where: { userId: user.id } });
    const isTech = tech && job.booking.technicianId === tech.id;
    
    const cust = await db.customerProfile.findUnique({ where: { userId: user.id } });
    const isCust = cust && job.booking.customerId === cust.id;
    
    if (user.role !== "ADMIN" && !isTech && !isCust) throw new HttpError(403, "Not authorized");

    return ok({ inspection: job.inspection });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { user, profile } = await requireTechnicianProfile();
    const { jobId } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const job = await db.repairJob.findUnique({
      where: { id: jobId },
      include: { booking: true, inspection: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (user.role !== "ADMIN" && job.booking.technicianId !== profile.id) {
      throw new HttpError(403, "Not your job");
    }

    // Upsert inspection.
    const inspection = job.inspection
      ? await db.repairInspection.update({
          where: { jobId },
          data: parsed,
        })
      : await db.repairInspection.create({
          data: { jobId, ...parsed },
        });

    return ok({ inspection });
  } catch (e) {
    return apiError(e);
  }
}
