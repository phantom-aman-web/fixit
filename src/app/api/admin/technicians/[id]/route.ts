import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireRole, HttpError } from "@/lib/api";

const schema = z.object({ status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);
    const tech = await db.technicianProfile.update({
      where: { id },
      data: { status: parsed.status },
    });
    return ok({ technician: tech });
  } catch (e) {
    return apiError(e);
  }
}
