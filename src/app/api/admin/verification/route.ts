import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireRole, HttpError } from "@/lib/api";
import { auditLog } from "@/services/audit-service";

const schema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  verified: z.boolean().optional(),
});

// GET /api/admin/verification — list pending technician documents + profiles.
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "PENDING";

    const documents = await db.technicianDocument.findMany({
      where: { status },
      include: { technician: { include: { user: true, skills: true, serviceAreas: { include: { serviceArea: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    // Also list PENDING technicians (status PENDING on profile).
    const pendingTechs = await db.technicianProfile.findMany({
      where: { status: "PENDING" },
      include: { user: true, skills: true, serviceAreas: { include: { serviceArea: true } }, documents: true },
      orderBy: { createdAt: "desc" },
    });

    return ok({ documents, pendingTechs });
  } catch (e) {
    return apiError(e);
  }
}

// PATCH /api/admin/verification — approve/reject a document or technician.
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireRole("ADMIN");
    const body = await req.json();
    const parsed = schema.parse(body);

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    const technicianId = searchParams.get("technicianId");

    if (documentId) {
      const doc = await db.technicianDocument.update({
        where: { id: documentId },
        data: { status: parsed.status === "ACTIVE" ? "APPROVED" : "REJECTED", reviewedBy: admin.id },
      });
      await auditLog({
        actorId: admin.id, actorRole: "ADMIN", action: "document_reviewed",
        entityType: "technician_document", entityId: documentId,
        metadata: { status: doc.status },
      });
      return ok({ document: doc });
    }

    if (technicianId) {
      const tech = await db.technicianProfile.update({
        where: { id: technicianId },
        data: { status: parsed.status, verified: parsed.verified ?? (parsed.status === "ACTIVE") },
      });
      await auditLog({
        actorId: admin.id, actorRole: "ADMIN", action: "technician_verified",
        entityType: "technician", entityId: technicianId,
        metadata: { status: parsed.status, verified: tech.verified },
      });

      // Notify technician.
      await db.notification.create({
        data: {
          userId: tech.userId,
          type: "verification_update",
          title: parsed.status === "ACTIVE" ? "Your account has been approved" : "Your account has been suspended",
          body: parsed.status === "ACTIVE" ? "You can now receive repair requests." : "Please contact support.",
          dataJson: JSON.stringify({ technicianId }),
        },
      });

      return ok({ technician: tech });
    }

    throw new HttpError(400, "documentId or technicianId required");
  } catch (e) {
    return apiError(e);
  }
}
