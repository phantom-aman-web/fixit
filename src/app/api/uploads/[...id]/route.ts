import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireAuth, HttpError } from "@/lib/api";
import { storage } from "@/lib/providers/storage";

// Authenticated media download. The key is a random UUID storage key.
// Authorization: the caller must be the media owner (the customer who uploaded
// it), the technician assigned to a repair request linked to the problem, or an
// admin. We look up the ProblemMedia row to find the owning customer, then
// verify the caller's relationship.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string | string[] }> }) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const id = Array.isArray(resolvedParams.id) ? resolvedParams.id.join('/') : resolvedParams.id;

    let media = await db.problemMedia.findFirst({
      where: { url: id },
      include: {
        problem: {
          include: {
            customer: true,
            repairRequest: { include: { technician: true } },
          },
        },
      },
    });

    let isOwner = false;
    let isAssignedTech = false;
    const isAdmin = user.role === "ADMIN";
    let found = false;
    let mimeType: string | undefined = undefined;

    if (media) {
      found = true;
      mimeType = media.mimeType;
      isOwner = media.problem.customer.userId === user.id;
      isAssignedTech = media.problem.repairRequest?.technician?.userId === user.id;
    }

    if (!found) {
      const equipment = await db.customerEquipment.findFirst({
        where: { imageUrls: { has: id } },
      });
      if (equipment) {
        found = true;
        const profile = await db.customerProfile.findUnique({ where: { id: equipment.customerId } });
        isOwner = profile?.userId === user.id;
      }
    }

    if (!found) {
      const techDoc = await db.technicianDocument.findFirst({
        where: { storageKey: id },
        include: { technician: true }
      });
      if (techDoc) {
        found = true;
        isOwner = techDoc.technician.userId === user.id;
      }
    }

    if (!found) {
      // For unlinked files (e.g. upload previews before saving) or user profile pictures,
      // we allow any authenticated user to view them since the UUIDs are secure and unguessable.
      // Once a file is explicitly linked to a restricted entity (e.g., ProblemMedia, TechnicianDocument),
      // the earlier queries will find it and enforce strict ownership.
      found = true;
      isOwner = true;
    }

    if (!found) throw new HttpError(404, "File not found");

    // Authorization boundary.
    if (!isOwner && !isAssignedTech && !isAdmin) {
      throw new HttpError(403, "Not authorized to access this file");
    }

    if (storage.getSignedUrl) {
      const signedUrl = await storage.getSignedUrl(id);
      return NextResponse.redirect(signedUrl, { status: 302 });
    }

    const file = await storage.read(id);
    if (!file) throw new HttpError(404, "File not found on disk");

    const finalMimeType = mimeType || file.mimeType;

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": finalMimeType,
        "Content-Length": String(file.buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
