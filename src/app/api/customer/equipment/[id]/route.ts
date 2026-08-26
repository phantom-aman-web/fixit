import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const eq = await db.customerEquipment.findUnique({ where: { id } });
    if (!eq || eq.customerId !== profile.id) throw new HttpError(404, "Equipment not found");
    await db.customerEquipment.delete({ where: { id } });
    return ok({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const eq = await db.customerEquipment.findUnique({
      where: { id },
      include: { 
        category: true, 
        maintenanceRecords: { orderBy: { date: "desc" } },
        problemReports: { orderBy: { createdAt: "desc" } }
      },
    });
    if (!eq || eq.customerId !== profile.id) throw new HttpError(404, "Equipment not found");
    return ok({ equipment: eq });
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireCustomerProfile();
    const { id } = await params;
    const eq = await db.customerEquipment.findUnique({ where: { id } });
    if (!eq || eq.customerId !== profile.id) throw new HttpError(404, "Equipment not found");

    const body = await req.json();
    const { brand, model, serialNumber, nickname, notes, purchaseDate, imageUrls, customCategoryName } = body;

    const updated = await db.customerEquipment.update({
      where: { id },
      data: {
        brand,
        model,
        serialNumber,
        nickname,
        notes,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        imageUrls,
        customCategoryName,
      },
      include: { category: true },
    });

    return ok({ equipment: updated });
  } catch (e) {
    return apiError(e);
  }
}
