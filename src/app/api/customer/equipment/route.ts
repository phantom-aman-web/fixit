import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

const createSchema = z.object({
  categoryId: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  nickname: z.string().optional(),
  notes: z.string().optional(),
  purchaseDate: z.string().optional(),
  imageUrls: z.array(z.string()).default([]),
  customCategoryName: z.string().optional(),
});

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const items = await db.customerEquipment.findMany({
      where: { customerId: profile.id },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    return ok({ equipment: items });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const cat = await db.equipmentCategory.findUnique({ where: { id: parsed.categoryId } });
    if (!cat) throw new HttpError(404, "Category not found");

    const eq = await db.customerEquipment.create({
      data: {
        customerId: profile.id,
        categoryId: parsed.categoryId,
        brand: parsed.brand,
        model: parsed.model,
        serialNumber: parsed.serialNumber,
        nickname: parsed.nickname,
        notes: parsed.notes,
        purchaseDate: parsed.purchaseDate ? new Date(parsed.purchaseDate) : undefined,
        imageUrls: parsed.imageUrls,
        customCategoryName: parsed.customCategoryName,
      },
      include: { category: true },
    });
    return ok({ equipment: eq }, 201);
  } catch (e) {
    return apiError(e);
  }
}
