import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";
import { auditLog } from "@/services/audit-service";

const schema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  baseCallOutFee: z.number().int().min(0).optional(),
  hourlyRate: z.number().int().min(0).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function GET() {
  try {
    const { profile } = await requireTechnicianProfile();
    const full = await db.technicianProfile.findUnique({
      where: { id: profile.id },
      include: { skills: true, serviceAreas: { include: { serviceArea: true } }, documents: true, earnings: true },
    });
    return ok({ profile: full });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const updated = await db.technicianProfile.update({
      where: { id: profile.id },
      data: parsed,
    });

    await auditLog({
      actorId: profile.userId,
      actorRole: "TECHNICIAN",
      action: "technician_profile_updated",
      entityType: "technician",
      entityId: profile.id,
    });

    return ok({ profile: updated });
  } catch (e) {
    return apiError(e);
  }
}
