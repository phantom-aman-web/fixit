import { db } from "@/lib/db";
import { ok, apiError, requireRole } from "@/lib/api";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const cats = await db.equipmentCategory.findMany({
      include: {
        symptoms: {
          include: {
            questions: { include: { options: true }, orderBy: { order: "asc" } },
          },
        },
        possibleCauses: { include: { troubleshootingSteps: { orderBy: { order: "asc" } } } },
        rules: true,
      },
      orderBy: { name: "asc" },
    });
    return ok({ categories: cats });
  } catch (e) {
    return apiError(e);
  }
}
