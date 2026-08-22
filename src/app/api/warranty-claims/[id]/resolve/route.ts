import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireRole, HttpError } from "@/lib/api";

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "RESOLVED"]),
  resolution: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    const claim = await db.warrantyClaim.findUnique({ where: { id } });
    if (!claim) throw new HttpError(404, "Claim not found");

    const updated = await db.warrantyClaim.update({
      where: { id },
      data: {
        status: parsed.status,
        resolution: parsed.resolution,
        resolvedBy: admin.id,
      },
    });
    return ok({ claim: updated });
  } catch (e) {
    return apiError(e);
  }
}
