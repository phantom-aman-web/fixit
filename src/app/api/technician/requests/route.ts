import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    // Requests either explicitly assigned to this technician OR matched to them.
    const requests = await db.repairRequest.findMany({
      where: {
        OR: [
          { technicianId: profile.id },
          { matches: { some: { technicianId: profile.id } } },
        ],
        ...(status ? { status } : {}),
      },
      include: {
        problem: { include: { category: true, equipment: true, media: true, customer: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } } } },
        session: true,
        customer: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } },
        matches: { where: { technicianId: profile.id } },
        quote: { include: { items: true } },
        booking: { include: { repairJob: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ requests });
  } catch (e) {
    return apiError(e);
  }
}

