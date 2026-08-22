import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireAuth, HttpError } from "@/lib/api";
import { storage } from "@/lib/providers/storage";

// Authenticated media download. The key is a random UUID storage key.
// Authorization: the caller must be the media owner (the customer who uploaded
// it), the technician assigned to a repair request linked to the problem, or an
// admin. We look up the ProblemMedia row to find the owning customer, then
// verify the caller's relationship.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const media = await db.problemMedia.findFirst({
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

    if (!media) throw new HttpError(404, "File not found");

    // Authorization boundary.
    const isOwner = media.problem.customer.userId === user.id;
    const isAssignedTech = media.problem.repairRequest?.technician?.userId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAssignedTech && !isAdmin) {
      throw new HttpError(403, "Not authorized to access this file");
    }

    if (storage.getSignedUrl) {
      const signedUrl = await storage.getSignedUrl(id);
      return NextResponse.redirect(signedUrl, { status: 302 });
    }

    const file = await storage.read(id);
    if (!file) throw new HttpError(404, "File not found on disk");

    const mimeType = media.mimeType || file.mimeType;

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(file.buffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
