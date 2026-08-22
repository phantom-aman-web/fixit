import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";
import { deleteAvailabilitySlot } from "@/services/scheduling-service";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireTechnicianProfile();
    const { id } = await params;
    await deleteAvailabilitySlot(profile.id, id);
    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
