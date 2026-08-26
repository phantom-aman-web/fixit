import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile({ allowPending: true });
    const jobs = await db.booking.findMany({
      where: { technicianId: profile.id },
      include: {
        customer: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } },
        repairRequest: { include: { problem: { include: { category: true } } } },
        quote: { include: { items: true } },
        repairJob: { 
          include: { 
            statusHistory: { orderBy: { createdAt: "desc" } },
            parts: true,
            review: true,
            customerReview: true,
            warranty: true
          }
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ jobs, status: profile.status });
  } catch (e) {
    return apiError(e);
  }
}

