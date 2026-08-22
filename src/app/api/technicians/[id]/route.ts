import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, HttpError } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tech = await db.technicianProfile.findUnique({
      where: { id },
      include: {
        skills: true,
        serviceAreas: { include: { serviceArea: true } },
        reviews: {
          include: { customer: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!tech) throw new HttpError(404, "Technician not found");
    return ok({ technician: tech });
  } catch (e) {
    return apiError(e);
  }
}
