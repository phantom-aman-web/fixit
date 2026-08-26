import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, requireCustomerProfile, HttpError } from "@/lib/api";
import { notify } from "@/services/notifications";
import { auditLog } from "@/services/audit-service";
import { checkGeneralRateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  jobId: z.string(),
  reason: z.enum(["repair_quality", "unexpected_charge", "incomplete_work", "other"]),
  description: z.string().min(10).max(2000),
});

// GET — list disputes (customer sees own, technician sees own, admin sees all)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let where: any = {};
    if (user.role === "ADMIN") {
      where = status ? { status } : {};
    } else if (user.role === "TECHNICIAN") {
      const tp = await db.technicianProfile.findUnique({ where: { userId: user.id } });
      if (!tp) throw new HttpError(404, "Technician profile not found");
      where = { technicianId: tp.id, ...(status ? { status } : {}) };
    } else {
      const cp = await db.customerProfile.findUnique({ where: { userId: user.id } });
      if (!cp) throw new HttpError(404, "Customer profile not found");
      where = { customerId: cp.id, ...(status ? { status } : {}) };
    }

    const disputes = await db.dispute.findMany({
      where,
      include: {
        job: { include: { booking: { include: { technician: true, customer: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } } } } } },
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ disputes });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const rl = checkGeneralRateLimit(profile.userId, "dispute");
    if (!rl.allowed) return ok({ error: "Rate limit exceeded", retryAfterMs: rl.retryAfterMs }, 429);

    const body = await req.json();
    const parsed = createSchema.parse(body);

    // Verify the job belongs to the customer and is completed.
    const job = await db.repairJob.findUnique({
      where: { id: parsed.jobId },
      include: { booking: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (job.booking.customerId !== profile.id) throw new HttpError(403, "Not your job");
    if (job.status !== "COMPLETED") throw new HttpError(400, "Can only dispute completed jobs");

    // Check for existing dispute.
    const existing = await db.dispute.findUnique({ where: { jobId: parsed.jobId } });
    if (existing) throw new HttpError(409, "A dispute already exists for this job");

    const dispute = await db.dispute.create({
      data: {
        jobId: parsed.jobId,
        customerId: profile.id,
        technicianId: job.booking.technicianId,
        reason: parsed.reason,
        description: parsed.description,
        status: "OPEN",
      },
    });

    await auditLog({
      actorId: profile.userId,
      actorRole: "CUSTOMER",
      action: "dispute_created",
      entityType: "dispute",
      entityId: dispute.id,
      metadata: { jobId: parsed.jobId, reason: parsed.reason },
    });

    // Notify technician via the central notification service.
    const tech = await db.technicianProfile.findUnique({
      where: { id: job.booking.technicianId },
    });
    if (tech) {
      void notify({
        userId: tech.userId,
        type: "dispute_created",
        title: "A dispute has been opened",
        body: `A customer has opened a dispute regarding job ${parsed.jobId.slice(-6)}.`,
        data: { disputeId: dispute.id },
      });
    }

    return ok({ dispute }, 201);
  } catch (e) {
    return apiError(e);
  }
}

