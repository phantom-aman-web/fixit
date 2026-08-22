import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

const schema = z.object({
  subCity: z.string().optional(),
  phone: z.string().optional(),
});

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    return ok({ profile });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);
    const updated = await db.customerProfile.update({
      where: { id: profile.id },
      data: { subCity: parsed.subCity, phone: parsed.phone },
    });
    return ok({ profile: updated });
  } catch (e) {
    return apiError(e);
  }
}
