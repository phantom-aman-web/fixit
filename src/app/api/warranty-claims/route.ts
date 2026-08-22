import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireAuth, requireCustomerProfile, HttpError } from "@/lib/api";

const schema = z.object({
  warrantyId: z.string(),
  description: z.string().min(10).max(2000),
});

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const claims = await db.warrantyClaim.findMany({
      where: { customerId: profile.id },
      include: { warranty: { include: { job: { include: { booking: { include: { technician: true } } } } } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ claims });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);

    const warranty = await db.warranty.findUnique({
      where: { id: parsed.warrantyId },
      include: { job: { include: { booking: true } } },
    });
    if (!warranty) throw new HttpError(404, "Warranty not found");
    if (warranty.job.booking.customerId !== profile.id) throw new HttpError(403, "Not your warranty");
    if (warranty.status !== "ACTIVE") throw new HttpError(400, "Warranty is not active");
    if (warranty.endDate < new Date()) throw new HttpError(400, "Warranty has expired");

    // Prevent duplicate open claims for the same warranty.
    const existingOpen = await db.warrantyClaim.findFirst({
      where: { warrantyId: parsed.warrantyId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
    });
    if (existingOpen) throw new HttpError(409, "An open claim already exists for this warranty");

    const claim = await db.warrantyClaim.create({
      data: {
        warrantyId: parsed.warrantyId,
        customerId: profile.id,
        description: parsed.description,
        status: "OPEN",
      },
    });
    return ok({ claim }, 201);
  } catch (e) {
    return apiError(e);
  }
}
