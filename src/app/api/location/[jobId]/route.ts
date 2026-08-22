import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";
import { ADDIS_ABABA_AREAS } from "@/lib/geo";

const schema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  etaMinutes: z.number().int().optional(),
});

// GET /api/location/[jobId] — customer views technician location during active service.
// Only available when job status is EN_ROUTE or ARRIVED. Privacy-conscious.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireAuth();
    const { jobId } = await params;
    const job = await db.repairJob.findUnique({
      where: { id: jobId },
      include: { booking: { include: { customer: true, technician: true } } },
    });
    if (!job) throw new HttpError(404, "Job not found");

    const isCust = job.booking.customer.userId === user.id;
    const isTech = job.booking.technician?.userId === user.id;
    if (user.role !== "ADMIN" && !isCust && !isTech) throw new HttpError(403, "Not authorized");

    // Privacy: location is only available during EN_ROUTE or ARRIVED.
    if (job.status !== "EN_ROUTE" && job.status !== "ARRIVED") {
      return ok({ location: null, reason: "Technician location is only available during travel and arrival.", isDemo: true });
    }

    const latestPing = await db.technicianLocationPing.findFirst({
      where: { jobId },
      orderBy: { createdAt: "desc" },
    });

    return ok({
      location: latestPing,
      isDemo: latestPing?.isDemo ?? true,
      jobStatus: job.status,
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/location/[jobId] — technician updates their location during active service.
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { user, profile } = await requireTechnicianProfile();
    const { jobId } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const job = await db.repairJob.findUnique({
      where: { id: jobId },
      include: { booking: true },
    });
    if (!job) throw new HttpError(404, "Job not found");
    if (user.role !== "ADMIN" && job.booking.technicianId !== profile.id) {
      throw new HttpError(403, "Not your job");
    }

    // Only allow location pings during EN_ROUTE or ARRIVED.
    if (job.status !== "EN_ROUTE" && job.status !== "ARRIVED") {
      throw new HttpError(400, "Location updates only allowed during travel/arrival");
    }

    const ping = await db.technicianLocationPing.create({
      data: {
        jobId,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        etaMinutes: parsed.etaMinutes,
        isDemo: true, // Phase 3: no real GPS — clearly marked demo
      },
    });

    return ok({ ping }, 201);
  } catch (e) {
    return apiError(e);
  }
}

// Import at the end to avoid circular deps in the type checker.
import { requireTechnicianProfile } from "@/lib/api";
