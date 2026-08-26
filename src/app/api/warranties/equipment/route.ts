import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, badRequest } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const { equipmentId, provider, startDate, endDate, notes, receiptUrl } = body;

    if (!equipmentId || !provider || !startDate || !endDate) {
      return badRequest("Missing required fields");
    }

    // Verify ownership
    const equipment = await db.customerEquipment.findUnique({
      where: { id: equipmentId },
    });

    if (!equipment || equipment.customerId !== profile.id) {
      return badRequest("Equipment not found");
    }

    const warranty = await db.equipmentWarranty.create({
      data: {
        equipmentId,
        provider,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes,
        receiptUrl,
      },
    });

    return ok({ equipmentWarranty: warranty });
  } catch (e: any) {
    return apiError(e);
  }
}
