import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, requireTechnicianProfile, unauthorized, badRequest } from "@/lib/api";

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const jobWarranties = await db.warranty.findMany({
      where: { job: { booking: { customerId: profile.id } } },
      include: { job: { include: { booking: { include: { technician: true, repairRequest: { include: { problem: { include: { category: true } } } } } } } } },
      orderBy: { endDate: "asc" },
    });

    const equipmentWarranties = await db.equipmentWarranty.findMany({
      where: { equipment: { customerId: profile.id } },
      include: { equipment: { include: { category: true } } },
      orderBy: { endDate: "asc" },
    });

    return ok({ warranties: jobWarranties, equipmentWarranties });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { profile: techProfile } = await requireTechnicianProfile();
    const body = await req.json();
    const { jobId, durationMonths, coveredWork, documentUrl } = body;

    if (!jobId || !durationMonths || !coveredWork) {
      return badRequest("Missing required fields");
    }

    // Verify the technician owns the job
    const job = await db.repairJob.findFirst({
      where: { id: jobId, booking: { technicianId: techProfile.id } },
    });

    if (!job) {
      return unauthorized();
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + parseInt(durationMonths));

    const warranty = await db.warranty.create({
      data: {
        jobId,
        startDate,
        endDate,
        durationMonths: parseInt(durationMonths),
        coveredWork,
        documentUrl,
        status: "ACTIVE",
      },
    });

    return ok({ warranty });
  } catch (e: any) {
    return apiError(e);
  }
}
