import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, HttpError } from "@/lib/api";

const schema = z.object({
  bookingUpdates: z.boolean().default(true),
  repairUpdates: z.boolean().default(true),
  paymentNotifications: z.boolean().default(true),
  warrantyReminders: z.boolean().default(true),
  reviewRequests: z.boolean().default(true),
  disputeUpdates: z.boolean().default(true),
  marketing: z.boolean().default(false),
});

export async function GET() {
  try {
    const user = await requireAuth();
    let prefs = await db.notificationPreference.findUnique({ where: { userId: user.id } });
    if (!prefs) {
      prefs = await db.notificationPreference.create({ data: { userId: user.id } });
    }
    return ok({ preferences: prefs });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = schema.parse(body);

    const prefs = await db.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed },
      update: parsed,
    });
    return ok({ preferences: prefs });
  } catch (e) {
    return apiError(e);
  }
}
