import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";
import { auditLog } from "@/services/audit-service";

const assignSchema = z.object({
  serviceAreaId: z.string().min(1),
});

// GET — return all available service areas (master list) plus the technician's current assignments
export async function GET() {
  try {
    const { profile } = await requireTechnicianProfile();

    const [allAreas, assignments] = await Promise.all([
      db.serviceArea.findMany({ orderBy: { name: "asc" } }),
      db.serviceAreaAssignment.findMany({
        where: { technicianId: profile.id },
        select: { serviceAreaId: true },
      }),
    ]);

    const assignedIds = assignments.map((a) => a.serviceAreaId);

    return ok({ areas: allAreas, assignedIds });
  } catch (e) {
    return apiError(e);
  }
}

// POST — assign a service area to the technician
export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const { serviceAreaId } = assignSchema.parse(body);

    // Verify the area exists
    const area = await db.serviceArea.findUnique({ where: { id: serviceAreaId } });
    if (!area) {
      throw new HttpError(404, "Service area not found");
    }

    // Check if already assigned (upsert-like)
    const existing = await db.serviceAreaAssignment.findFirst({
      where: { technicianId: profile.id, serviceAreaId },
    });
    if (existing) {
      return ok({ assignment: existing, message: "Already assigned" });
    }

    const assignment = await db.serviceAreaAssignment.create({
      data: { technicianId: profile.id, serviceAreaId },
    });

    await auditLog({
      actorId: profile.userId,
      actorRole: "TECHNICIAN",
      action: "service_area_assigned",
      entityType: "service_area_assignment",
      entityId: assignment.id,
    });

    return ok({ assignment });
  } catch (e) {
    return apiError(e);
  }
}

// DELETE — remove a service area assignment
export async function DELETE(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const { serviceAreaId } = assignSchema.parse(body);

    const existing = await db.serviceAreaAssignment.findFirst({
      where: { technicianId: profile.id, serviceAreaId },
    });
    if (!existing) {
      throw new HttpError(404, "Assignment not found");
    }

    await db.serviceAreaAssignment.delete({ where: { id: existing.id } });

    await auditLog({
      actorId: profile.userId,
      actorRole: "TECHNICIAN",
      action: "service_area_unassigned",
      entityType: "service_area_assignment",
      entityId: existing.id,
    });

    return ok({ deleted: true });
  } catch (e) {
    return apiError(e);
  }
}
