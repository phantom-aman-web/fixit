import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireTechnicianProfile, HttpError } from "@/lib/api";
import { setAvailabilitySlot } from "@/services/scheduling-service";

const schema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  specificDate: z.string().optional(),
  startMinutes: z.number().int().min(0).max(1439),
  endMinutes: z.number().int().min(1).max(1440),
  isBlock: z.boolean().default(false),
});

export async function GET() {
  try {
    const { profile } = await requireTechnicianProfile({ allowPending: true });
    const slots = await db.availabilitySlot.findMany({
      where: { technicianId: profile.id },
      orderBy: { dayOfWeek: "asc" },
    });
    return ok({ slots });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireTechnicianProfile();
    const body = await req.json();
    const parsed = schema.parse(body);
    if (parsed.startMinutes >= parsed.endMinutes) {
      throw new HttpError(400, "Start time must be before end time");
    }
    const slot = await setAvailabilitySlot(profile.id, {
      dayOfWeek: parsed.dayOfWeek,
      specificDate: parsed.specificDate ? new Date(parsed.specificDate) : undefined,
      startMinutes: parsed.startMinutes,
      endMinutes: parsed.endMinutes,
      isBlock: parsed.isBlock,
    });
    return ok({ slot }, 201);
  } catch (e) {
    return apiError(e);
  }
}
