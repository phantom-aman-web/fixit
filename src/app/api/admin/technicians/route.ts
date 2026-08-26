import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireRole } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const techs = await db.technicianProfile.findMany({
      where: status ? { status } : undefined,
      include: { skills: true, serviceAreas: { include: { serviceArea: true } }, user: { select: { id: true, name: true, email: true, image: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ technicians: techs });
  } catch (e) {
    return apiError(e);
  }
}

