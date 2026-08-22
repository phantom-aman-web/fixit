import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile } from "@/lib/api";

export async function GET() {
  try {
    const { profile } = await requireTechnicianProfile();
    const jobs = await db.repairJob.findMany({
      where: { booking: { technicianId: profile.id } },
      include: {
        booking: {
          include: {
            customer: { include: { user: true } },
            repairRequest: { include: { problem: { include: { category: true } } } },
            quote: { include: { items: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: "desc" } },
        parts: true,
        review: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ jobs });
  } catch (e) {
    return apiError(e);
  }
}
