import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categorySlug = searchParams.get("category");
    const minRating = Number(searchParams.get("minRating") || "0");
    const maxCallOut = Number(searchParams.get("maxCallOut") || "0");
    const verifiedOnly = searchParams.get("verified") === "1";
    const area = searchParams.get("area");

    const techs = await db.technicianProfile.findMany({
      where: { status: "ACTIVE" },
      include: {
        skills: true,
        serviceAreas: { include: { serviceArea: true } },
        reviews: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { rating: "desc" },
    });

    let filtered = techs;
    if (categorySlug) {
      filtered = filtered.filter((t) => t.skills.some((s) => s.equipmentCategory === categorySlug));
    }
    if (minRating > 0) filtered = filtered.filter((t) => t.rating >= minRating);
    if (maxCallOut > 0) filtered = filtered.filter((t) => !t.baseCallOutFee || t.baseCallOutFee <= maxCallOut);
    if (verifiedOnly) filtered = filtered.filter((t) => t.verified);
    if (area) filtered = filtered.filter((t) => t.serviceAreas.some((a) => a.serviceArea.name === area));

    return ok({ technicians: filtered });
  } catch (e) {
    return apiError(e);
  }
}
