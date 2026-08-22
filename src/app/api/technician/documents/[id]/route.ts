import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireAuth, HttpError } from "@/lib/api";
import { storage } from "@/lib/providers/storage";

// GET /api/technician/documents/[id] — download a verification document.
// Authorization: the owning technician, or an admin. Customers cannot access
// technician verification documents (IDOR protection).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const doc = await db.technicianDocument.findUnique({
      where: { id },
      include: { technician: true },
    });
    if (!doc) throw new HttpError(404, "Document not found");

    // Authorization: owning technician or admin only.
    if (user.role !== "ADMIN" && doc.technician.userId !== user.id) {
      throw new HttpError(403, "Not authorized to access this document");
    }

    if (storage.getSignedUrl) {
      const signedUrl = await storage.getSignedUrl(doc.storageKey);
      return NextResponse.redirect(signedUrl, { status: 302 });
    }

    const file = await storage.read(doc.storageKey);
    if (!file) throw new HttpError(404, "File not found on disk");

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(file.buffer.byteLength),
        "Content-Disposition": `inline; filename="${doc.fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
