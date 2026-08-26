import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, apiError, requireCustomerProfile, HttpError } from "@/lib/api";

const schema = z.object({
  categoryId: z.string(),
  equipmentId: z.string().optional(),
  description: z.string().min(5).max(2000),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "EMERGENCY"]).default("NORMAL"),
  customCategoryName: z.string().optional(),
  customSymptom: z.string().optional(),
  symptomIds: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    const { profile } = await requireCustomerProfile();
    const items = await db.problemReport.findMany({
      where: { customerId: profile.id },
      include: { category: true, equipment: true, media: true, diagnosticSessions: { orderBy: { startedAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ problems: items });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile } = await requireCustomerProfile();
    const body = await req.json();
    const parsed = schema.parse(body);
    if (parsed.equipmentId) {
      const eq = await db.customerEquipment.findUnique({ where: { id: parsed.equipmentId } });
      if (!eq || eq.customerId !== profile.id) throw new HttpError(403, "Not your equipment");
    }
    const problem = await db.problemReport.create({
      data: {
        customerId: profile.id,
        categoryId: parsed.categoryId,
        equipmentId: parsed.equipmentId,
        description: parsed.description,
        urgency: parsed.urgency,
        customCategoryName: parsed.customCategoryName,
        customSymptom: parsed.customSymptom,
        symptomIds: parsed.symptomIds,
      },
      include: { category: true },
    });
    return ok({ problem }, 201);
  } catch (e) {
    return apiError(e);
  }
}
