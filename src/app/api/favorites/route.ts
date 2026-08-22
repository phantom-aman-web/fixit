import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const favorites = await db.favoriteTechnician.findMany({
      where: { customerId: profile.id },
      include: { technician: { include: { skills: true, serviceAreas: { include: { serviceArea: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ favorites });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const { technicianId } = await req.json();
    if (!technicianId) throw new HttpError(400, "technicianId required");

    const tech = await db.technicianProfile.findUnique({ where: { id: technicianId } });
    if (!tech) throw new HttpError(404, "Technician not found");

    // Idempotent: if already favorited, return existing.
    const existing = await db.favoriteTechnician.findUnique({
      where: { customerId_technicianId: { customerId: profile.id, technicianId } },
    });
    if (existing) return ok({ favorite: existing });

    const fav = await db.favoriteTechnician.create({
      data: { customerId: profile.id, technicianId },
    });
    return ok({ favorite: fav }, 201);
  } catch (e) {
    return apiError(e);
  }
}
