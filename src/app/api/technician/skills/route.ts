import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";
import { auditLog } from "@/services/audit-service";

const addSchema = z.object({
  skill: z.string().min(1).max(100),
  equipmentCategory: z.string().max(100).optional(),
  proficiency: z.number().int().min(1).max(5).default(3),
});

const deleteSchema = z.object({
  skillId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const { skill, equipmentCategory, proficiency } = addSchema.parse(body);

    const created = await db.technicianSkill.create({
      data: {
        technicianId: profile.id,
        skill,
        equipmentCategory: equipmentCategory || null,
        proficiency,
      },
    });

    await auditLog({
      actorId: profile.userId,
      actorRole: "TECHNICIAN",
      action: "technician_skill_added",
      entityType: "technician_skill",
      entityId: created.id,
    });

    return ok({ skill: created });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const { skillId } = deleteSchema.parse(body);

    // Verify ownership
    const existing = await db.technicianSkill.findFirst({
      where: { id: skillId, technicianId: profile.id },
    });
    if (!existing) {
      throw new HttpError(404, "Skill not found");
    }

    await db.technicianSkill.delete({ where: { id: skillId } });

    await auditLog({
      actorId: profile.userId,
      actorRole: "TECHNICIAN",
      action: "technician_skill_removed",
      entityType: "technician_skill",
      entityId: skillId,
    });

    return ok({ deleted: true });
  } catch (e) {
    return apiError(e);
  }
}
