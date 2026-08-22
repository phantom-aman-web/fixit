import { db } from "@/lib/db";
import { ok, apiError } from "@/lib/api";

export async function GET() {
  try {
    const cats = await db.equipmentCategory.findMany({
      include: {
        symptoms: { orderBy: { name: "asc" } },
        models: true,
      },
      orderBy: { name: "asc" },
    });
    return ok({ categories: cats });
  } catch (e) {
    return apiError(e);
  }
}
